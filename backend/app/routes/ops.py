import csv
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.db import list_deployment_records, list_deployment_templates, list_notifications, list_servers
from app.schemas import (
    OpsAttentionItem,
    OpsDeploymentsSummary,
    OpsNotificationsSummary,
    OpsOverviewResponse,
    OpsReleaseIncidentSummary,
    OpsReleaseMaintenanceSummary,
    OpsRuntimeCapabilitiesSummary,
    OpsServersSummary,
    OpsTemplatesSummary,
    OpsUserSummary,
)
from app.services.auth import require_auth, user_is_admin
from app.services.deployments import local_docker_runtime_enabled
from app.services.runtime_access import (
    sanitize_notifications_for_user,
    sanitize_remote_target_fields,
)
from app.services.server_credentials import SERVER_CREDENTIALS_KEY_ENV


router = APIRouter(prefix="/ops", dependencies=[Depends(require_auth)])
RELEASE_MAINTENANCE_STATUS_FILE_ENV = "DEPLOYMATE_RELEASE_MAINTENANCE_STATUS_FILE"


def _collection_or_empty(
    loader: Callable[[], list[dict]],
    *,
    degraded_label: str,
    attention_items: list[OpsAttentionItem],
) -> list[dict]:
    try:
        return loader()
    except Exception:
        attention_items.append(
            OpsAttentionItem(
                level="warn",
                title=f"{degraded_label} data is temporarily unavailable",
                detail=f"DeployMate returned a degraded overview because {degraded_label.lower()} could not be loaded.",
            )
        )
        return []


def _collection_or_503(loader: Callable[[], list[dict]], *, label: str) -> list[dict]:
    try:
        return loader()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"{label} export is temporarily unavailable.",
        ) from exc


def _infer_activity_category(title: str | None, message: str | None) -> str:
    haystack = " ".join(filter(None, [title, message])).lower()
    if not haystack:
        return "general"
    if "redeploy" in haystack:
        return "redeploy"
    if "delete" in haystack:
        return "delete"
    if "health" in haystack:
        return "health"
    if "deploy" in haystack:
        return "deploy"
    return "general"


def _is_recent_date(value: str | None, days: int = 7) -> bool:
    if not value:
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    delta = datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)
    return delta.total_seconds() <= days * 24 * 60 * 60


def _build_runtime_capabilities_summary() -> OpsRuntimeCapabilitiesSummary:
    ssh_mode = os.getenv("DEPLOYMATE_SSH_HOST_KEY_CHECKING", "yes").strip().lower() or "yes"
    if ssh_mode not in {"yes", "accept-new", "no"}:
        ssh_mode = "yes"
    known_hosts_path = os.getenv("DEPLOYMATE_SSH_KNOWN_HOSTS_FILE", "").strip()
    strict_known_hosts_configured = False
    if ssh_mode == "yes" and known_hosts_path and os.path.isfile(known_hosts_path):
        strict_known_hosts_configured = os.path.getsize(known_hosts_path) > 0

    return OpsRuntimeCapabilitiesSummary(
        local_docker_enabled=local_docker_runtime_enabled(),
        ssh_host_key_checking=ssh_mode,
        strict_known_hosts_configured=strict_known_hosts_configured,
        server_credentials_key_configured=bool(os.getenv(SERVER_CREDENTIALS_KEY_ENV, "").strip()),
        remote_only_recommended=True,
    )


def _string_value(payload: dict, key: str, default: str = "") -> str:
    value = payload.get(key)
    if value is None:
        return default
    return str(value)


def _bool_status_value(payload: dict, key: str) -> bool:
    return _string_value(payload, key).strip().lower() in {"1", "true", "yes", "on"}


def _int_status_value(payload: dict, key: str, default: int = 0) -> int:
    try:
        return int(_string_value(payload, key, str(default)) or default)
    except ValueError:
        return default


def _release_incident_summary(
    payload: dict,
    *,
    environment: str,
    issue_number: int,
) -> OpsReleaseIncidentSummary:
    return OpsReleaseIncidentSummary(
        environment=environment,
        issue_number=issue_number,
        state=_string_value(payload, f"issue_{issue_number}_state", "unknown"),
        failure_category=_string_value(payload, f"issue_{issue_number}_failure_category", "unavailable"),
        operator_hint=_string_value(payload, f"issue_{issue_number}_operator_hint") or None,
    )


def _first_release_blocker(payload: dict, blocker_count: int) -> str | None:
    for index in range(1, blocker_count + 1):
        value = _string_value(payload, f"blocker_{index}")
        if value:
            return value
    return None


def _load_release_maintenance_payload() -> tuple[dict | None, str]:
    raw_path = os.getenv(RELEASE_MAINTENANCE_STATUS_FILE_ENV, "").strip()
    if not raw_path:
        return None, "not_configured"

    path = Path(raw_path)
    if not path.is_file():
        return None, "missing_file"

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None, "unreadable_file"

    maintenance = payload.get("maintenance") if isinstance(payload, dict) else None
    if isinstance(maintenance, dict):
        return maintenance, "public_evidence_bundle"
    if isinstance(payload, dict):
        return payload, "release_maintenance_status"
    return None, "unreadable_file"


def _build_release_maintenance_summary() -> OpsReleaseMaintenanceSummary:
    payload, source = _load_release_maintenance_payload()
    if payload is None:
        return OpsReleaseMaintenanceSummary(
            available=False,
            source=source,
            next_step=(
                "Publish the latest release-maintenance-status JSON to the runtime before using "
                "release unpause decisions."
            ),
        )

    blocker_count = _int_status_value(payload, "blocker_count")
    production = _release_incident_summary(payload, environment="production", issue_number=18)
    staging = _release_incident_summary(payload, environment="staging", issue_number=19)
    primary_blocker = _first_release_blocker(payload, blocker_count)
    next_step = "Release maintenance is ready; remove pauses only during a planned release window."

    for incident in (production, staging):
        if incident.state != "CLOSED" and incident.operator_hint:
            next_step = incident.operator_hint
            break
    else:
        if primary_blocker:
            next_step = f"Resolve this release blocker before unpause: {primary_blocker}."

    return OpsReleaseMaintenanceSummary(
        available=True,
        source=source,
        generated_at=_string_value(payload, "generated_at") or None,
        ready_for_unpause=_bool_status_value(payload, "ready_for_unpause"),
        release_audit_scheduled_paused=_bool_status_value(payload, "release_audit_scheduled_paused"),
        staging_release_paused=_bool_status_value(payload, "staging_release_paused"),
        network_checks=_string_value(payload, "network_checks", "unknown"),
        blocker_count=blocker_count,
        primary_blocker=primary_blocker,
        next_step=next_step,
        production=production,
        staging=staging,
    )


def _sanitize_server_export(item: dict) -> dict:
    return {
        "id": item.get("id"),
        "name": item.get("name"),
        "host": item.get("host"),
        "port": item.get("port"),
        "username": item.get("username"),
        "auth_type": item.get("auth_type"),
        "created_at": item.get("created_at"),
    }


def _visible_deployments_for_user(user: dict, *, sanitize: bool = False) -> list[dict]:
    deployments = list_deployment_records()
    if user_is_admin(user):
        return deployments
    visible = [item for item in deployments if item.get("owner_user_id") == user["id"]]
    if sanitize:
        return [sanitize_remote_target_fields(item, user) for item in visible]
    return visible


def _visible_templates_for_user(user: dict, *, sanitize: bool = False) -> list[dict]:
    templates = list_deployment_templates()
    if user_is_admin(user):
        return templates
    visible = [item for item in templates if item.get("owner_user_id") == user["id"]]
    if sanitize:
        return [sanitize_remote_target_fields(item, user) for item in visible]
    return visible


def _visible_notifications_for_user(
    user: dict,
    *,
    deployments: list[dict] | None = None,
    limit: int = 100,
) -> list[dict]:
    notifications = list_notifications(limit=max(limit, 1000))
    if user_is_admin(user):
        return notifications[:limit]

    visible_deployments = deployments or _visible_deployments_for_user(user)
    deployments_by_id = {item["id"]: item for item in visible_deployments}
    visible_deployment_ids = set(deployments_by_id)
    filtered = [
        item for item in notifications if item.get("deployment_id") in visible_deployment_ids
    ]
    return sanitize_notifications_for_user(filtered[:limit], deployments_by_id, user)


def _build_ops_overview(user: dict, *, notifications_limit: int = 100) -> OpsOverviewResponse:
    attention_items: list[OpsAttentionItem] = []
    deployments = _collection_or_empty(
        lambda: _visible_deployments_for_user(user),
        degraded_label="Deployments",
        attention_items=attention_items,
    )
    servers = _collection_or_empty(
        lambda: list_servers() if user_is_admin(user) else [],
        degraded_label="Servers",
        attention_items=attention_items,
    )
    templates = _collection_or_empty(
        lambda: _visible_templates_for_user(user),
        degraded_label="Templates",
        attention_items=attention_items,
    )
    notifications = _collection_or_empty(
        lambda: _visible_notifications_for_user(
            user,
            deployments=deployments,
            limit=notifications_limit,
        ),
        degraded_label="Activity",
        attention_items=attention_items,
    )

    active_server_ids = {deployment.get("server_id") for deployment in deployments if deployment.get("server_id")}
    failed_deployments = [item for item in deployments if item.get("status") == "failed"]
    running_deployments = [item for item in deployments if item.get("status") == "running"]
    pending_deployments = [item for item in deployments if item.get("status") == "pending"]
    local_deployments = [item for item in deployments if not item.get("server_id")]
    remote_deployments = [item for item in deployments if item.get("server_id")]
    exposed_deployments = [
        item for item in deployments if item.get("external_port") is not None
    ]
    public_url_deployments = [
        item for item in deployments if item.get("server_host") and item.get("external_port")
    ]
    password_servers = [item for item in servers if item.get("auth_type") == "password"]
    ssh_key_servers = [item for item in servers if item.get("auth_type") == "ssh_key"]
    unused_servers = [item for item in servers if item.get("id") not in active_server_ids]
    error_notifications = [item for item in notifications if item.get("level") == "error"]
    success_notifications = [item for item in notifications if item.get("level") == "success"]
    recent_error = error_notifications[0] if error_notifications else None
    unused_templates = [item for item in templates if int(item.get("use_count") or 0) == 0]
    recent_templates = [item for item in templates if _is_recent_date(item.get("last_used_at"), 7)]
    popular_templates = sorted(
        [item for item in templates if int(item.get("use_count") or 0) > 0],
        key=lambda item: int(item.get("use_count") or 0),
        reverse=True,
    )
    top_template = popular_templates[0] if popular_templates else None
    capabilities = _build_runtime_capabilities_summary()
    release_maintenance = _build_release_maintenance_summary()

    if user.get("must_change_password"):
        attention_items.append(
            OpsAttentionItem(
                level="warn",
                title="Default admin password is still active",
                detail="Change it before making more production changes.",
            )
        )

    if failed_deployments:
        attention_items.append(
            OpsAttentionItem(
                level="error",
                title=f"{len(failed_deployments)} failed deployment{'s' if len(failed_deployments) != 1 else ''}",
                detail="Open deployment details and activity history before the next rollout.",
            )
        )

    if error_notifications:
        attention_items.append(
            OpsAttentionItem(
                level="warn",
                title=f"{len(error_notifications)} recent error event{'s' if len(error_notifications) != 1 else ''}",
                detail=(recent_error or {}).get("title") or "Review recent activity history.",
            )
        )

    if not servers:
        attention_items.append(
            OpsAttentionItem(
                level="info",
                title="No saved servers" if user_is_admin(user) else "No admin server access",
                detail=(
                    "Only local deploys are available until a VPS target is added."
                    if user_is_admin(user)
                    else "Remote server inventory stays admin-only until sharing rules exist."
                ),
            )
        )

    if unused_templates:
        attention_items.append(
            OpsAttentionItem(
                level="info",
                title=f"{len(unused_templates)} template{'s' if len(unused_templates) != 1 else ''} never used",
                detail="Review whether they are still useful or should be cleaned up later.",
            )
        )

    if any(item.get("external_port") is None for item in running_deployments):
        attention_items.append(
            OpsAttentionItem(
                level="info",
                title="Some running deployments have no external port",
                detail="They may be internal-only or require proxy access.",
            )
        )

    if capabilities.local_docker_enabled:
        attention_items.append(
            OpsAttentionItem(
                level="warn",
                title="Local Docker execution is enabled",
                detail="Remote-only remains the recommended runtime posture for production.",
            )
        )

    if capabilities.ssh_host_key_checking != "yes":
        attention_items.append(
            OpsAttentionItem(
                level="warn",
                title="SSH host trust is not pinned",
                detail="Switch back to strict known-host verification for stronger remote target trust.",
            )
        )

    if capabilities.ssh_host_key_checking == "yes" and not capabilities.strict_known_hosts_configured:
        attention_items.append(
            OpsAttentionItem(
                level="error",
                title="Strict SSH trust is enabled but not ready",
                detail=(
                    "Prepare a non-empty known_hosts file before running remote server checks or deployments."
                ),
            )
        )

    if not capabilities.server_credentials_key_configured and servers:
        attention_items.append(
            OpsAttentionItem(
                level="error",
                title="Server credential key is missing",
                detail="Configure DEPLOYMATE_SERVER_CREDENTIALS_KEY before handling stored server credentials.",
            )
        )

    if not release_maintenance.available:
        attention_items.append(
            OpsAttentionItem(
                level="info",
                title="Release maintenance status is not connected",
                detail=release_maintenance.next_step,
            )
        )
    elif not release_maintenance.ready_for_unpause:
        attention_items.append(
            OpsAttentionItem(
                level="error",
                title="Release maintenance is not ready for unpause",
                detail=release_maintenance.next_step,
            )
        )

    return OpsOverviewResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        user=OpsUserSummary(
            username=user["username"],
            plan=user.get("plan", "trial"),
            role=user.get("role", "member"),
        ),
        deployments=OpsDeploymentsSummary(
            total=len(deployments),
            running=len(running_deployments),
            failed=len(failed_deployments),
            pending=len(pending_deployments),
            local=len(local_deployments),
            remote=len(remote_deployments),
            exposed=len(exposed_deployments),
            public_urls=len(public_url_deployments),
        ),
        servers=OpsServersSummary(
            total=len(servers),
            password_auth=len(password_servers),
            ssh_key_auth=len(ssh_key_servers),
            unused=len(unused_servers),
        ),
        notifications=OpsNotificationsSummary(
            total=len(notifications),
            success=len(success_notifications),
            error=len(error_notifications),
            latest_error_title=(recent_error or {}).get("title"),
            latest_error_at=(recent_error or {}).get("created_at"),
        ),
        templates=OpsTemplatesSummary(
            total=len(templates),
            unused=len(unused_templates),
            recently_used=len(recent_templates),
            top_template_name=(top_template or {}).get("template_name"),
            top_template_use_count=int((top_template or {}).get("use_count") or 0),
        ),
        capabilities=capabilities,
        release_maintenance=release_maintenance,
        attention_items=attention_items,
    )


def _csv_response(filename: str, rows: Iterable[dict], fieldnames: list[str]) -> Response:
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


@router.get("/overview", response_model=OpsOverviewResponse)
def get_ops_overview(
    notifications_limit: int = Query(default=100, ge=10, le=500),
    user=Depends(require_auth),
) -> OpsOverviewResponse:
    return _build_ops_overview(user, notifications_limit=notifications_limit)


@router.get("/exports/deployments")
def export_deployments(
    format: str = Query(default="json", pattern="^(json|csv)$"),
    user=Depends(require_auth),
):
    items = _collection_or_503(
        lambda: _visible_deployments_for_user(user, sanitize=True),
        label="Deployments",
    )
    if format == "csv":
        return _csv_response(
            "deploymate-deployments.csv",
            items,
            [
                "id",
                "status",
                "image",
                "container_name",
                "container_id",
                "server_id",
                "server_name",
                "server_host",
                "internal_port",
                "external_port",
                "error",
                "created_at",
            ],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}


@router.get("/exports/servers")
def export_servers(
    format: str = Query(default="json", pattern="^(json|csv)$"),
    user=Depends(require_auth),
):
    if not user_is_admin(user):
        raise HTTPException(
            status_code=403,
            detail="Remote server inventory is admin-only.",
        )
    items = [
        _sanitize_server_export(item)
        for item in _collection_or_503(lambda: list_servers(), label="Servers")
    ]
    if format == "csv":
        return _csv_response(
            "deploymate-servers.csv",
            items,
            ["id", "name", "host", "port", "username", "auth_type", "created_at"],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}


@router.get("/exports/templates")
def export_templates(
    format: str = Query(default="json", pattern="^(json|csv)$"),
    user=Depends(require_auth),
):
    items = _collection_or_503(
        lambda: _visible_templates_for_user(user, sanitize=True),
        label="Templates",
    )
    if format == "csv":
        return _csv_response(
            "deploymate-templates.csv",
            items,
            [
                "id",
                "template_name",
                "image",
                "name",
                "server_id",
                "server_name",
                "server_host",
                "internal_port",
                "external_port",
                "use_count",
                "last_used_at",
                "updated_at",
                "created_at",
            ],
        )
    return {"exported_at": datetime.now(timezone.utc).isoformat(), "count": len(items), "items": items}


@router.get("/exports/activity")
def export_activity(
    format: str = Query(default="json", pattern="^(json|csv)$"),
    limit: int = Query(default=200, ge=1, le=1000),
    user=Depends(require_auth),
):
    items = _collection_or_503(
        lambda: _visible_notifications_for_user(user, limit=limit),
        label="Activity",
    )
    normalized = [
        {
            **item,
            "category": _infer_activity_category(item.get("title"), item.get("message")),
        }
        for item in items
    ]
    if format == "csv":
        return _csv_response(
            "deploymate-activity.csv",
            normalized,
            ["id", "deployment_id", "level", "category", "title", "message", "created_at"],
        )
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(normalized),
        "items": normalized,
    }
