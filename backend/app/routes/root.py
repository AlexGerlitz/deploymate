import csv
import io
import json
import uuid
from datetime import datetime, timezone

from typing import List

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query
from fastapi.responses import Response

from app.db import (
    count_users_by_role,
    create_admin_audit_event,
    delete_user_record,
    get_session_user_by_token,
    list_deployment_records,
    list_deployment_templates,
    get_upgrade_request_or_404,
    get_user_by_id,
    get_user_by_username,
    insert_upgrade_request,
    insert_user,
    list_admin_audit_events,
    list_servers,
    list_upgrade_requests,
    list_users,
    set_user_plan,
    set_user_role,
    update_upgrade_request,
)
from app.schemas import (
    AdminUserCreateRequest,
    AdminUserItem,
    AdminAttentionItem,
    AdminAuditItem,
    AdminAuditSummary,
    AdminOverviewResponse,
    AdminUpgradeRequestsSummary,
    AdminUserUpdateRequest,
    AdminUsersSummary,
    BackupBundleManifest,
    BackupBundleResponse,
    RestoreDryRunIssue,
    RestoreDryRunRequest,
    RestoreDryRunResponse,
    RestoreDryRunSection,
    RestoreDryRunSummary,
    UpgradeRequestCreate,
    UpgradeRequestItem,
    UpgradeRequestResponse,
    UpgradeRequestUpdateRequest,
)
from app.services.auth import SESSION_COOKIE_NAME, hash_password, require_admin


router = APIRouter()


def _csv_response(filename: str, rows: list[dict], fieldnames: list[str]) -> Response:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow({field: row.get(field) for field in fieldnames})

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _json_attachment_response(filename: str, payload: dict) -> Response:
    return Response(
        content=json.dumps(payload, ensure_ascii=True, indent=2),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_admin_audit_summary(items: list[dict]) -> AdminAuditSummary:
    user_actions = [item for item in items if item.get("target_type") == "user"]
    upgrade_actions = [item for item in items if item.get("target_type") == "upgrade_request"]
    latest = items[0] if items else None
    return AdminAuditSummary(
        total=len(items),
        user_actions=len(user_actions),
        upgrade_request_actions=len(upgrade_actions),
        latest_action_type=latest.get("action_type") if latest else None,
        latest_action_at=latest.get("created_at") if latest else None,
    )


def _build_backup_bundle() -> BackupBundleResponse:
    data = {
        "users": list_users(),
        "upgrade_requests": list_upgrade_requests(),
        "audit_events": list_admin_audit_events(limit=1000),
        "servers": list_servers(),
        "deployments": list_deployment_records(),
        "templates": list_deployment_templates(),
    }
    manifest = BackupBundleManifest(
        version="2026-04-01.backup-bundle.v1",
        generated_at=datetime.now(timezone.utc).isoformat(),
        bundle_name=f"deploymate-backup-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}",
        sections={name: len(items) for name, items in data.items()},
    )
    return BackupBundleResponse(manifest=manifest, data=data)


def _issue(severity: str, code: str, message: str) -> RestoreDryRunIssue:
    return RestoreDryRunIssue(severity=severity, code=code, message=message)


def _finalize_section(section: RestoreDryRunSection) -> RestoreDryRunSection:
    if section.blockers:
        section.status = "error"
    elif section.warnings:
        section.status = "warn"
    else:
        section.status = "ok"
    return section


def _analyze_restore_bundle(bundle: dict) -> RestoreDryRunResponse:
    manifest_raw = bundle.get("manifest")
    data_raw = bundle.get("data")

    if not isinstance(manifest_raw, dict):
        raise HTTPException(status_code=400, detail="Bundle manifest is missing or invalid.")
    if not isinstance(data_raw, dict):
        raise HTTPException(status_code=400, detail="Bundle data is missing or invalid.")

    manifest = BackupBundleManifest(**manifest_raw)

    current_users = list_users()
    current_upgrade_requests = list_upgrade_requests()
    current_audit_events = list_admin_audit_events(limit=1000)
    current_servers = list_servers()
    current_deployments = list_deployment_records()
    current_templates = list_deployment_templates()

    sections: list[RestoreDryRunSection] = []

    incoming_users = data_raw.get("users") if isinstance(data_raw.get("users"), list) else []
    section = RestoreDryRunSection(
        name="users",
        incoming_count=len(incoming_users),
        current_count=len(current_users),
    )
    current_usernames = {item.get("username"): item for item in current_users}
    seen_usernames: set[str] = set()
    for item in incoming_users:
        username = item.get("username")
        if not username:
            section.blockers.append(_issue("error", "missing_username", "User entry is missing username."))
            continue
        if username in seen_usernames:
            section.blockers.append(_issue("error", "duplicate_username_bundle", f'Bundle contains duplicate username "{username}".'))
        seen_usernames.add(username)
        existing = current_usernames.get(username)
        if existing and existing.get("id") != item.get("id"):
            section.blockers.append(_issue("error", "username_conflict", f'Username "{username}" already exists in current system.'))
        elif existing:
            section.warnings.append(_issue("warn", "user_id_exists", f'User "{username}" already exists and would require merge handling.'))
    section.notes.append("Users can be validated safely, but restore apply should stay controlled because of credential state.")
    sections.append(_finalize_section(section))

    incoming_requests = data_raw.get("upgrade_requests") if isinstance(data_raw.get("upgrade_requests"), list) else []
    section = RestoreDryRunSection(
        name="upgrade_requests",
        incoming_count=len(incoming_requests),
        current_count=len(current_upgrade_requests),
    )
    current_request_ids = {item.get("id") for item in current_upgrade_requests}
    seen_request_ids: set[str] = set()
    for item in incoming_requests:
        request_id = item.get("id")
        if not request_id:
            section.blockers.append(_issue("error", "missing_request_id", "Upgrade request entry is missing id."))
            continue
        if request_id in seen_request_ids:
            section.blockers.append(_issue("error", "duplicate_request_id_bundle", f'Bundle contains duplicate upgrade request id "{request_id}".'))
        seen_request_ids.add(request_id)
        if request_id in current_request_ids:
            section.warnings.append(_issue("warn", "request_id_exists", f'Upgrade request "{request_id}" already exists in current system.'))
    section.notes.append("Upgrade requests can usually be restored after ID and linking review.")
    sections.append(_finalize_section(section))

    incoming_audit = data_raw.get("audit_events") if isinstance(data_raw.get("audit_events"), list) else []
    section = RestoreDryRunSection(
        name="audit_events",
        incoming_count=len(incoming_audit),
        current_count=len(current_audit_events),
    )
    current_audit_ids = {item.get("id") for item in current_audit_events}
    seen_audit_ids: set[str] = set()
    for item in incoming_audit:
        audit_id = item.get("id")
        if not audit_id:
            section.blockers.append(_issue("error", "missing_audit_id", "Audit event entry is missing id."))
            continue
        if audit_id in seen_audit_ids:
            section.blockers.append(_issue("error", "duplicate_audit_id_bundle", f'Bundle contains duplicate audit id "{audit_id}".'))
        seen_audit_ids.add(audit_id)
        if audit_id in current_audit_ids:
            section.warnings.append(_issue("warn", "audit_id_exists", f'Audit event "{audit_id}" already exists in current system.'))
    section.notes.append("Audit history is append-only and low-risk, but duplicate IDs should be deduplicated on restore.")
    sections.append(_finalize_section(section))

    incoming_servers = data_raw.get("servers") if isinstance(data_raw.get("servers"), list) else []
    section = RestoreDryRunSection(
        name="servers",
        incoming_count=len(incoming_servers),
        current_count=len(current_servers),
    )
    current_server_names = {item.get("name"): item for item in current_servers}
    current_server_targets = {f'{item.get("username")}@{item.get("host")}:{item.get("port")}': item for item in current_servers}
    seen_server_names: set[str] = set()
    seen_server_targets: set[str] = set()
    for item in incoming_servers:
        name = item.get("name")
        target = f'{item.get("username")}@{item.get("host")}:{item.get("port")}'
        if not name or not item.get("host") or not item.get("username"):
            section.blockers.append(_issue("error", "invalid_server", "Server entry is missing required identity fields."))
            continue
        if name in seen_server_names:
            section.blockers.append(_issue("error", "duplicate_server_name_bundle", f'Bundle contains duplicate server name "{name}".'))
        if target in seen_server_targets:
            section.blockers.append(_issue("error", "duplicate_server_target_bundle", f'Bundle contains duplicate server target "{target}".'))
        seen_server_names.add(name)
        seen_server_targets.add(target)
        if name in current_server_names and current_server_names[name].get("id") != item.get("id"):
            section.blockers.append(_issue("error", "server_name_conflict", f'Server name "{name}" already exists in current system.'))
        if target in current_server_targets and current_server_targets[target].get("id") != item.get("id"):
            section.warnings.append(_issue("warn", "server_target_conflict", f'Server target "{target}" already exists in current system.'))
    section.notes.append("Server restore is sensitive because credentials and remote targets may have changed.")
    sections.append(_finalize_section(section))

    incoming_templates = data_raw.get("templates") if isinstance(data_raw.get("templates"), list) else []
    section = RestoreDryRunSection(
        name="templates",
        incoming_count=len(incoming_templates),
        current_count=len(current_templates),
    )
    current_template_names = {item.get("template_name"): item for item in current_templates}
    seen_template_names: set[str] = set()
    for item in incoming_templates:
        name = item.get("template_name")
        if not name:
            section.blockers.append(_issue("error", "missing_template_name", "Template entry is missing template_name."))
            continue
        if name in seen_template_names:
            section.blockers.append(_issue("error", "duplicate_template_name_bundle", f'Bundle contains duplicate template "{name}".'))
        seen_template_names.add(name)
        existing = current_template_names.get(name)
        if existing and existing.get("id") != item.get("id"):
            section.blockers.append(_issue("error", "template_name_conflict", f'Template "{name}" already exists in current system.'))
        elif existing:
            section.warnings.append(_issue("warn", "template_id_exists", f'Template "{name}" already exists and would require merge handling.'))
    section.notes.append("Templates are good restore candidates after conflict cleanup.")
    sections.append(_finalize_section(section))

    incoming_deployments = data_raw.get("deployments") if isinstance(data_raw.get("deployments"), list) else []
    section = RestoreDryRunSection(
        name="deployments",
        incoming_count=len(incoming_deployments),
        current_count=len(current_deployments),
    )
    current_container_names = {item.get("container_name"): item for item in current_deployments}
    current_ports = {
        f'{item.get("server_id") or "local"}:{item.get("external_port")}': item
        for item in current_deployments
        if item.get("external_port") is not None
    }
    seen_container_names: set[str] = set()
    seen_ports: set[str] = set()
    for item in incoming_deployments:
        container_name = item.get("container_name")
        if not container_name:
            section.blockers.append(_issue("error", "missing_container_name", "Deployment entry is missing container_name."))
            continue
        if container_name in seen_container_names:
            section.blockers.append(_issue("error", "duplicate_container_name_bundle", f'Bundle contains duplicate container "{container_name}".'))
        seen_container_names.add(container_name)
        if container_name in current_container_names and current_container_names[container_name].get("id") != item.get("id"):
            section.blockers.append(_issue("error", "container_name_conflict", f'Container "{container_name}" already exists in current system.'))
        external_port = item.get("external_port")
        if external_port is not None:
            port_key = f'{item.get("server_id") or "local"}:{external_port}'
            if port_key in seen_ports:
                section.blockers.append(_issue("error", "duplicate_port_bundle", f'Bundle contains duplicate external port "{external_port}" on the same target.'))
            seen_ports.add(port_key)
            if port_key in current_ports and current_ports[port_key].get("id") != item.get("id"):
                section.blockers.append(_issue("error", "deployment_port_conflict", f'External port "{external_port}" is already used on the target environment.'))
    section.notes.append("Deployment restore is runtime-sensitive and should stay dry-run only for now.")
    sections.append(_finalize_section(section))

    blocker_count = sum(len(section.blockers) for section in sections)
    warning_count = sum(len(section.warnings) for section in sections)
    total_records = sum(section.incoming_count for section in sections)
    ok_sections = sum(1 for section in sections if section.status == "ok")
    review_required_sections = sum(1 for section in sections if section.status == "warn")
    blocked_sections = sum(1 for section in sections if section.status == "error")

    return RestoreDryRunResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        manifest=manifest,
        summary=RestoreDryRunSummary(
            total_sections=len(sections),
            total_records=total_records,
            blocker_count=blocker_count,
            warning_count=warning_count,
            ok_sections=ok_sections,
            review_required_sections=review_required_sections,
            blocked_sections=blocked_sections,
        ),
        sections=sections,
    )


@router.get("/")
def read_root() -> dict:
    return {
        "service": "DeployMate API",
        "status": "ok",
    }


@router.get("/health")
def health_check() -> dict:
    return {
        "status": "healthy",
        "service": "deploymate-backend",
    }


@router.post("/upgrade-requests", response_model=UpgradeRequestResponse)
def create_upgrade_request(
    payload: UpgradeRequestCreate,
    session_token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> UpgradeRequestResponse:
    current_plan = payload.current_plan
    if session_token:
        user = get_session_user_by_token(session_token)
        if user:
            current_plan = user.get("plan", current_plan)

    request_id = str(uuid.uuid4())
    insert_upgrade_request(
        {
            "id": request_id,
            "name": payload.name,
            "email": payload.email,
            "company_or_team": payload.company_or_team,
            "use_case": payload.use_case,
            "current_plan": current_plan,
            "status": "new",
            "internal_note": None,
            "handled_by_user_id": None,
            "target_user_id": None,
            "reviewed_at": None,
            "updated_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
        }
    )
    return UpgradeRequestResponse(request_id=request_id, status="submitted")


@router.get(
    "/admin/upgrade-requests",
    response_model=List[UpgradeRequestItem],
    dependencies=[Depends(require_admin)],
)
def get_upgrade_requests(
    status: str = Query(default="all", pattern="^(all|new|in_review|approved|rejected|closed)$"),
    plan: str = Query(default="all", pattern="^(all|trial|solo|team)$"),
    q: str = Query(default=""),
    linked_only: bool = Query(default=False),
) -> List[UpgradeRequestItem]:
    normalized_query = q.strip().lower()
    items = list_upgrade_requests()
    filtered: list[UpgradeRequestItem] = []
    for item in items:
      if status != "all" and item.get("status") != status:
          continue
      if plan != "all" and (item.get("current_plan") or "") != plan:
          continue
      if linked_only and not item.get("target_user_id"):
          continue
      if normalized_query:
          haystack = " ".join(
              filter(
                  None,
                  [
                      item.get("name"),
                      item.get("email"),
                      item.get("company_or_team"),
                      item.get("use_case"),
                      item.get("current_plan"),
                      item.get("status"),
                      item.get("target_username"),
                      item.get("handled_by_username"),
                  ],
              )
          ).lower()
          if normalized_query not in haystack:
              continue
      filtered.append(UpgradeRequestItem(**item))
    return filtered


@router.get(
    "/admin/upgrade-requests/{request_id}",
    response_model=UpgradeRequestItem,
    dependencies=[Depends(require_admin)],
)
def get_upgrade_request(request_id: str) -> UpgradeRequestItem:
    return UpgradeRequestItem(**get_upgrade_request_or_404(request_id))


@router.patch(
    "/admin/upgrade-requests/{request_id}",
    response_model=UpgradeRequestItem,
)
def update_upgrade_request_endpoint(
    request_id: str,
    payload: UpgradeRequestUpdateRequest,
    admin_user=Depends(require_admin),
) -> UpgradeRequestItem:
    request_item = get_upgrade_request_or_404(request_id)
    if (
        payload.status is None
        and payload.internal_note is None
        and payload.target_user_id is None
        and payload.plan is None
    ):
        raise HTTPException(status_code=400, detail="At least one field must be provided.")

    target_user_id = payload.target_user_id
    if target_user_id == "":
        target_user_id = None

    if target_user_id:
        target_user = get_user_by_id(target_user_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found.")
    else:
        target_user = None

    if payload.plan is not None and not target_user_id:
        raise HTTPException(
            status_code=400,
            detail="target_user_id is required when assigning a plan.",
        )

    if target_user and payload.plan is not None:
        set_user_plan(target_user_id, payload.plan)

    now = datetime.now(timezone.utc)
    reviewed_at = request_item.get("reviewed_at")
    if payload.status is not None and payload.status != "new":
        reviewed_at = reviewed_at or now

    internal_note = request_item.get("internal_note")
    if payload.internal_note is not None:
        internal_note = payload.internal_note.strip() or None

    update_upgrade_request(
        request_id,
        status=payload.status,
        internal_note=internal_note,
        handled_by_user_id=admin_user["id"],
        target_user_id=target_user_id,
        reviewed_at=reviewed_at,
        updated_at=now,
    )
    updated_request = get_upgrade_request_or_404(request_id)
    create_admin_audit_event(
        actor_user_id=admin_user["id"],
        action_type="upgrade_request.updated",
        target_type="upgrade_request",
        target_id=request_id,
        target_label=updated_request.get("email") or updated_request.get("name"),
        details=", ".join(
            filter(
                None,
                [
                    f"status -> {payload.status}" if payload.status is not None else None,
                    "internal note updated" if payload.internal_note is not None else None,
                    f"target user -> {target_user.get('username')}" if target_user else None,
                    f"plan -> {payload.plan}" if payload.plan is not None else None,
                ],
            )
        )
        or "Upgrade request updated.",
    )
    return UpgradeRequestItem(**updated_request)


@router.get(
    "/admin/users",
    response_model=List[AdminUserItem],
    dependencies=[Depends(require_admin)],
)
def get_users(
    role: str = Query(default="all", pattern="^(all|admin|member)$"),
    plan: str = Query(default="all", pattern="^(all|trial|solo|team)$"),
    q: str = Query(default=""),
    must_change_password: bool | None = Query(default=None),
) -> List[AdminUserItem]:
    normalized_query = q.strip().lower()
    items = list_users()
    filtered: list[AdminUserItem] = []
    for item in items:
      if role != "all" and item.get("role") != role:
          continue
      if plan != "all" and item.get("plan") != plan:
          continue
      if must_change_password is not None and bool(item.get("must_change_password")) != must_change_password:
          continue
      if normalized_query and normalized_query not in (item.get("username") or "").lower():
          continue
      filtered.append(AdminUserItem(**item))
    return filtered


@router.get(
    "/admin/overview",
    response_model=AdminOverviewResponse,
    dependencies=[Depends(require_admin)],
)
def get_admin_overview() -> AdminOverviewResponse:
    users = list_users()
    upgrade_requests = list_upgrade_requests()
    audit_events = list_admin_audit_events(limit=200)

    admins = [item for item in users if item.get("role") == "admin"]
    members = [item for item in users if item.get("role") == "member"]
    trial_users = [item for item in users if item.get("plan") == "trial"]
    solo_users = [item for item in users if item.get("plan") == "solo"]
    team_users = [item for item in users if item.get("plan") == "team"]
    must_change_users = [item for item in users if item.get("must_change_password")]

    new_requests = [item for item in upgrade_requests if item.get("status") == "new"]
    in_review_requests = [item for item in upgrade_requests if item.get("status") == "in_review"]
    approved_requests = [item for item in upgrade_requests if item.get("status") == "approved"]
    rejected_requests = [item for item in upgrade_requests if item.get("status") == "rejected"]
    closed_requests = [item for item in upgrade_requests if item.get("status") == "closed"]
    linked_requests = [item for item in upgrade_requests if item.get("target_user_id")]

    attention_items: list[AdminAttentionItem] = []
    if must_change_users:
        attention_items.append(
            AdminAttentionItem(
                level="warn",
                title=f"{len(must_change_users)} user{'s' if len(must_change_users) != 1 else ''} must change password",
                detail="Review user security state from the admin users page.",
            )
        )
    if new_requests:
        attention_items.append(
            AdminAttentionItem(
                level="info",
                title=f"{len(new_requests)} new upgrade request{'s' if len(new_requests) != 1 else ''}",
                detail="Review inbound demand in the upgrade inbox.",
            )
        )
    if approved_requests and len(linked_requests) < len(approved_requests):
        attention_items.append(
            AdminAttentionItem(
                level="warn",
                title="Some approved upgrade requests are not linked to users",
                detail="Link approved requests to target users where appropriate.",
            )
        )
    if len(admins) <= 1:
        attention_items.append(
            AdminAttentionItem(
                level="info",
                title="Only one admin account remains",
                detail="Consider adding another admin account for operational redundancy.",
            )
        )
    if not audit_events:
        attention_items.append(
            AdminAttentionItem(
                level="info",
                title="No admin audit history yet",
                detail="Audit entries will appear after admin create, update, or review actions.",
            )
        )

    return AdminOverviewResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        users=AdminUsersSummary(
            total=len(users),
            admins=len(admins),
            members=len(members),
            trial=len(trial_users),
            solo=len(solo_users),
            team=len(team_users),
            must_change_password=len(must_change_users),
        ),
        upgrade_requests=AdminUpgradeRequestsSummary(
            total=len(upgrade_requests),
            new=len(new_requests),
            in_review=len(in_review_requests),
            approved=len(approved_requests),
            rejected=len(rejected_requests),
            closed=len(closed_requests),
            linked_users=len(linked_requests),
        ),
        attention_items=attention_items,
    )


@router.get(
    "/admin/exports/users",
    dependencies=[Depends(require_admin)],
)
def export_admin_users(format: str = Query(default="json", pattern="^(json|csv)$")):
    items = list_users()
    if format == "csv":
        return _csv_response(
            "deploymate-admin-users.csv",
            items,
            ["id", "username", "role", "plan", "must_change_password", "created_at"],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}


@router.get(
    "/admin/exports/upgrade-requests",
    dependencies=[Depends(require_admin)],
)
def export_admin_upgrade_requests(format: str = Query(default="json", pattern="^(json|csv)$")):
    items = list_upgrade_requests()
    if format == "csv":
        return _csv_response(
            "deploymate-upgrade-requests.csv",
            items,
            [
                "id",
                "status",
                "name",
                "email",
                "company_or_team",
                "use_case",
                "current_plan",
                "handled_by_username",
                "target_username",
                "reviewed_at",
                "updated_at",
                "created_at",
            ],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}


@router.get(
    "/admin/backup-bundle",
    response_model=BackupBundleResponse,
    dependencies=[Depends(require_admin)],
)
def get_admin_backup_bundle() -> BackupBundleResponse:
    return _build_backup_bundle()


@router.get(
    "/admin/exports/backup-bundle",
    dependencies=[Depends(require_admin)],
)
def export_admin_backup_bundle():
    bundle = _build_backup_bundle()
    return _json_attachment_response(
        f"{bundle.manifest.bundle_name}.json",
        bundle.model_dump(),
    )


@router.post(
    "/admin/restore/dry-run",
    response_model=RestoreDryRunResponse,
    dependencies=[Depends(require_admin)],
)
def run_restore_dry_run(payload: RestoreDryRunRequest) -> RestoreDryRunResponse:
    return _analyze_restore_bundle(payload.bundle)


@router.post(
    "/admin/users",
    response_model=AdminUserItem,
    dependencies=[Depends(require_admin)],
)
def create_user(
    payload: AdminUserCreateRequest,
    admin_user=Depends(require_admin),
) -> AdminUserItem:
    if get_user_by_username(payload.username):
        raise HTTPException(status_code=400, detail="Username already exists.")
    user_record = {
        "id": str(uuid.uuid4()),
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "plan": "trial",
        "role": payload.role,
        "must_change_password": False,
        "created_at": datetime.now(timezone.utc),
    }
    insert_user(user_record)
    create_admin_audit_event(
        actor_user_id=admin_user["id"],
        action_type="user.created",
        target_type="user",
        target_id=user_record["id"],
        target_label=payload.username,
        details=f"Role {payload.role}, initial plan trial.",
    )
    return AdminUserItem(**get_user_by_id(user_record["id"]))


@router.patch(
    "/admin/users/{user_id}",
    response_model=AdminUserItem,
    dependencies=[Depends(require_admin)],
)
def update_user(
    user_id: str,
    payload: AdminUserUpdateRequest,
    admin_user=Depends(require_admin),
) -> AdminUserItem:
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if payload.role is None and payload.plan is None:
        raise HTTPException(status_code=400, detail="At least one field must be provided.")

    if (
        payload.role is not None
        and user["role"] == "admin"
        and payload.role != "admin"
        and count_users_by_role("admin") <= 1
    ):
        raise HTTPException(status_code=400, detail="Cannot demote the last admin user.")

    if payload.role is not None:
        set_user_role(user_id, payload.role)
    if payload.plan is not None:
        set_user_plan(user_id, payload.plan)

    updated_user = get_user_by_id(user_id)
    create_admin_audit_event(
        actor_user_id=admin_user["id"],
        action_type="user.updated",
        target_type="user",
        target_id=user_id,
        target_label=updated_user["username"] if updated_user else None,
        details=", ".join(
            filter(
                None,
                [
                    f"role -> {payload.role}" if payload.role is not None else None,
                    f"plan -> {payload.plan}" if payload.plan is not None else None,
                ],
            )
        )
        or "User updated.",
    )
    return AdminUserItem(**updated_user)


@router.delete(
    "/admin/users/{user_id}",
    dependencies=[Depends(require_admin)],
)
def delete_user(
    user_id: str,
    admin_user=Depends(require_admin),
) -> dict:
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user["role"] == "admin" and count_users_by_role("admin") <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last admin user.")
    delete_user_record(user_id)
    create_admin_audit_event(
        actor_user_id=admin_user["id"],
        action_type="user.deleted",
        target_type="user",
        target_id=user_id,
        target_label=user.get("username"),
        details=f"Deleted user with role {user.get('role')} and plan {user.get('plan')}.",
    )
    return {"user_id": user_id, "status": "deleted"}


@router.get(
    "/admin/audit-events",
    response_model=List[AdminAuditItem],
    dependencies=[Depends(require_admin)],
)
def get_admin_audit_events(
    limit: int = Query(default=100, ge=1, le=500),
    target_type: str = Query(default="all", pattern="^(all|user|upgrade_request)$"),
    q: str = Query(default=""),
) -> List[AdminAuditItem]:
    normalized_query = q.strip().lower()
    items = list_admin_audit_events(limit=limit)
    filtered: list[AdminAuditItem] = []
    for item in items:
        if target_type != "all" and item.get("target_type") != target_type:
            continue
        if normalized_query:
            haystack = " ".join(
                filter(
                    None,
                    [
                        item.get("actor_username"),
                        item.get("action_type"),
                        item.get("target_type"),
                        item.get("target_label"),
                        item.get("details"),
                    ],
                )
            ).lower()
            if normalized_query not in haystack:
                continue
        filtered.append(AdminAuditItem(**item))
    return filtered


@router.get(
    "/admin/audit-summary",
    response_model=AdminAuditSummary,
    dependencies=[Depends(require_admin)],
)
def get_admin_audit_summary() -> AdminAuditSummary:
    return _build_admin_audit_summary(list_admin_audit_events(limit=200))


@router.get(
    "/admin/exports/audit-events",
    dependencies=[Depends(require_admin)],
)
def export_admin_audit_events(format: str = Query(default="json", pattern="^(json|csv)$")):
    items = list_admin_audit_events(limit=1000)
    if format == "csv":
        return _csv_response(
            "deploymate-admin-audit-events.csv",
            items,
            [
                "id",
                "actor_username",
                "action_type",
                "target_type",
                "target_id",
                "target_label",
                "details",
                "created_at",
            ],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}
