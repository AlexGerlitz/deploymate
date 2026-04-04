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
    RestoreImportPlanResponse,
    RestoreImportPlanSection,
    RestoreImportPlanSummary,
    UpgradeRequestCreate,
    UpgradeRequestItem,
    UpgradeRequestResponse,
    UpgradeRequestUpdateRequest,
)
from app.services.auth import SESSION_COOKIE_NAME, hash_password, require_admin


router = APIRouter()
EXPECTED_BACKUP_SECTION_NAMES = (
    "users",
    "upgrade_requests",
    "audit_events",
    "servers",
    "deployments",
    "templates",
)


def _build_restore_readiness_summary(sections: list[RestoreDryRunSection]) -> tuple[str, str, str, list[str]]:
    blocked_sections = [section.name for section in sections if section.status == "error"]
    review_sections = [section.name for section in sections if section.status == "warn"]

    highest_risk_sections = blocked_sections[:]
    for name in review_sections:
        if len(highest_risk_sections) >= 3:
            break
        highest_risk_sections.append(name)

    if blocked_sections:
        next_step = (
            "Do not plan a live import yet. Resolve the blocked sections first, then rerun dry-run validation."
        )
        plain_language_summary = (
            f"This backup is not ready for any real import work yet because "
            f"{len(blocked_sections)} section(s) are blocked: {', '.join(blocked_sections)}."
        )
        return "blocked", next_step, plain_language_summary, highest_risk_sections

    if review_sections:
        next_step = (
            "This bundle can move into import preparation only after the review-required sections are cleaned up and validated again."
        )
        plain_language_summary = (
            f"This backup is not blocked, but it still needs manual review in "
            f"{len(review_sections)} section(s): {', '.join(review_sections)}."
        )
        return "review", next_step, plain_language_summary, highest_risk_sections

    next_step = "This bundle looks safe for structured import preparation. Keep the final apply flow behind manual review."
    plain_language_summary = (
        "This backup passed dry-run validation without active blockers or review-required sections."
    )
    return "safe", next_step, plain_language_summary, highest_risk_sections


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


def _apply_restore_preparation_guidance(section: RestoreDryRunSection) -> RestoreDryRunSection:
    if section.name == "deployments":
        section.preparation_mode = "dry_run_only"
        section.recommended_action = (
            "Keep deployments in dry-run only. Use this section for runtime review and manual rebuild planning instead of any future direct import."
        )
        return section

    if section.name == "servers":
        if section.status == "error":
            section.preparation_mode = "dry_run_only"
            section.recommended_action = (
                "Do not prepare server import yet. Resolve identity, trust, and target conflicts first, then rerun dry-run."
            )
        else:
            section.preparation_mode = "merge_review"
            section.recommended_action = (
                "Keep servers behind merge review. Validate host identity and SSH trust before treating them as import candidates."
            )
        return section

    if section.name == "users":
        section.preparation_mode = "merge_review"
        section.recommended_action = (
            "Review users as merge candidates only. Preserve credential and password-reset state rather than planning blind overwrite."
        )
        return section

    if section.name == "audit_events":
        section.preparation_mode = "validate_only"
        section.recommended_action = (
            "Validate audit event shape and deduplication needs, but keep this section low priority for any future import preparation."
        )
        return section

    if section.status == "error":
        section.preparation_mode = "merge_review"
        section.recommended_action = (
            "Resolve blockers in this section first, then rerun dry-run before any import preparation work."
        )
    elif section.status == "warn":
        section.preparation_mode = "merge_review"
        section.recommended_action = (
            "Clean up warnings and linking drift in this section, then rerun dry-run before moving into import preparation."
        )
    else:
        section.preparation_mode = "prepare_import"
        section.recommended_action = (
            "This section looks clean enough to document as an import-preparation candidate, while final apply stays manual."
        )

    return section


def _build_restore_preparation_summary(sections: list[RestoreDryRunSection]) -> tuple[str, int, int, int, int]:
    validate_only_sections = sum(1 for section in sections if section.preparation_mode == "validate_only")
    merge_review_sections = sum(1 for section in sections if section.preparation_mode == "merge_review")
    prepare_import_sections = sum(1 for section in sections if section.preparation_mode == "prepare_import")
    dry_run_only_sections = sum(1 for section in sections if section.preparation_mode == "dry_run_only")

    parts: list[str] = []
    if prepare_import_sections:
        parts.append(f"{prepare_import_sections} ready to document for import preparation")
    if merge_review_sections:
        parts.append(f"{merge_review_sections} still need merge review")
    if validate_only_sections:
        parts.append(f"{validate_only_sections} are validation-only")
    if dry_run_only_sections:
        parts.append(f"{dry_run_only_sections} should stay dry-run only")

    summary = "Preparation mix: " + ", ".join(parts) if parts else "Preparation mix is not available."
    return (
        summary,
        validate_only_sections,
        merge_review_sections,
        prepare_import_sections,
        dry_run_only_sections,
    )


def _build_restore_import_plan(report: RestoreDryRunResponse) -> RestoreImportPlanResponse:
    sections: list[RestoreImportPlanSection] = []

    for section in report.sections:
        if section.preparation_mode == "prepare_import" and section.status == "ok":
            plan_state = "include"
            include_in_plan = True
            rationale = "This section can be carried into a controlled import plan, but final apply still stays manual."
        elif section.preparation_mode == "dry_run_only" or section.status == "error":
            plan_state = "blocked" if section.status == "error" else "exclude"
            include_in_plan = False
            rationale = "This section must stay outside any future apply scope until the underlying runtime or safety risk is resolved."
        elif section.preparation_mode == "validate_only":
            plan_state = "exclude"
            include_in_plan = False
            rationale = "This section is useful for validation and context, but it should not be part of an import scope."
        else:
            plan_state = "review"
            include_in_plan = False
            rationale = "This section still needs operator review and cleanup before it can be considered for any import scope."

        sections.append(
            RestoreImportPlanSection(
                name=section.name,
                source_status=section.status,
                preparation_mode=section.preparation_mode,
                plan_state=plan_state,
                include_in_plan=include_in_plan,
                rationale=rationale,
                recommended_action=section.recommended_action,
            )
        )

    included_sections = [section.name for section in sections if section.plan_state == "include"]
    review_sections = [section.name for section in sections if section.plan_state == "review"]
    blocked_sections = [section.name for section in sections if section.plan_state == "blocked"]
    excluded_sections = [section.name for section in sections if section.plan_state == "exclude"]

    if blocked_sections:
        plan_status = "blocked"
    elif review_sections:
        plan_status = "review_required"
    else:
        plan_status = "ready_for_review"

    scope_parts: list[str] = []
    if included_sections:
        scope_parts.append(f"include {', '.join(included_sections)}")
    if review_sections:
        scope_parts.append(f"hold {', '.join(review_sections)} for review")
    if blocked_sections:
        scope_parts.append(f"block {', '.join(blocked_sections)}")
    if excluded_sections:
        scope_parts.append(f"exclude {', '.join(excluded_sections)}")

    plan_scope_summary = "Controlled import scope: " + "; ".join(scope_parts) if scope_parts else "Controlled import scope is empty."
    apply_block_reason = (
        "Live restore apply is intentionally blocked in DeployMate right now. This workspace is only for review, scoping, and operator handoff."
    )
    boundary_message = (
        "This is not an apply screen. Use it to narrow scope, confirm risks, and prepare handoff before any future controlled restore flow exists."
    )
    apply_readiness_status = "not_ready" if blocked_sections else "review_required"
    apply_readiness_summary = (
        "The operator can review and acknowledge scope, but the system is not ready for live restore apply."
        if blocked_sections
        else "The operator can review and acknowledge scope, but final apply still requires a future controlled restore flow."
    )
    acknowledgement_items = [
        "I reviewed the blocked and review-required sections, not just the included scope.",
        "I understand this screen does not authorize any live restore apply.",
        "I am using this plan only for review, handoff, or future controlled preparation.",
    ]
    typed_review_phrase = f"acknowledge import review {report.manifest.bundle_name}"
    approval_status = "approval_blocked" if blocked_sections else "approval_required"
    approval_packet_title = f"Import review approval for {report.manifest.bundle_name}"
    approval_subject_line = (
        f"[DeployMate import review] {report.manifest.bundle_name} requires approval handoff"
    )
    approval_share_summary = (
        f"Bundle {report.manifest.bundle_name}: plan {plan_status}, "
        f"included {len(included_sections)}, review {len(review_sections)}, blocked {len(blocked_sections)}."
    )
    approval_summary = (
        "Approval can only cover review scope and preparation handoff. Live apply remains blocked until a future controlled restore flow exists."
    )
    approval_decision_question = (
        "Do we approve this bundle for continued review and preparation work, without approving any live restore apply?"
    )
    approval_checklist = [
        "Blocked sections were explicitly reviewed, not ignored.",
        "Included sections were checked against current operator intent and environment drift.",
        "Everyone involved understands that approval here does not mean permission to run live restore apply.",
    ]
    approval_handoff_note = (
        "Use this packet to hand off a review decision, not an execution decision. If approval is granted, the next step is still controlled preparation only."
    )
    approval_next_step = (
        "Send the approval packet to the reviewer or approver, then keep work at the review/preparation boundary until a separate controlled restore flow exists."
    )
    if blocked_sections:
        preparation_status = "preparation_blocked"
    elif review_sections:
        preparation_status = "preparation_review_required"
    else:
        preparation_status = "preparation_ready"
    preparation_packet_title = f"Controlled preparation handoff for {report.manifest.bundle_name}"
    preparation_share_summary = (
        f"Preparation scope for {report.manifest.bundle_name}: "
        f"prepare {len(included_sections)}, review {len(review_sections)}, blocked {len(blocked_sections)}, exclude {len(excluded_sections)}."
    )
    preparation_summary = (
        "Controlled preparation can document included sections, keep review sections under manual review, and leave blocked sections outside any preparation scope."
    )
    preparation_checklist = [
        "Preparation work only covers documented scope and does not authorize execution.",
        "Review-required sections stay under manual review until their warnings are resolved.",
        "Blocked sections stay outside preparation and must be revalidated in a future dry-run.",
    ]
    preparation_handoff_note = (
        "Use this handoff when the next person needs to prepare documentation, sequence review work, or line up prerequisites without moving into live restore apply."
    )
    preparation_next_step = (
        "Document the included scope, assign review work for review-required sections, and keep blocked sections out of the preparation path until the next dry-run clears them."
    )
    if blocked_sections:
        workflow_focus = "Resolve blocked sections before any preparation handoff can be treated as ready."
        workflow_steps = [
            {
                "key": "dry_run",
                "title": "Validate restore bundle",
                "status": "complete",
                "detail": "Dry-run already ran on this bundle and exposed the current risk profile.",
            },
            {
                "key": "import_review",
                "title": "Review import scope",
                "status": "complete",
                "detail": "The operator already reviewed bundle scope, boundary messaging, and section states.",
            },
            {
                "key": "blocked_review",
                "title": "Resolve blocked sections",
                "status": "current",
                "detail": "Blocked sections still stop the flow here. Clean them up and rerun dry-run before safe preparation can move forward.",
            },
            {
                "key": "preparation_handoff",
                "title": "Hand off controlled preparation",
                "status": "blocked",
                "detail": "Preparation stays downstream, but it is not the active focus until blocked sections clear.",
            },
        ]
    elif review_sections:
        workflow_focus = "Move through review-required sections, then hand off controlled preparation."
        workflow_steps = [
            {
                "key": "dry_run",
                "title": "Validate restore bundle",
                "status": "complete",
                "detail": "Dry-run already validated the current bundle shape and risk profile.",
            },
            {
                "key": "import_review",
                "title": "Review import scope",
                "status": "complete",
                "detail": "Import review already narrowed the scope and confirmed the non-apply boundary.",
            },
            {
                "key": "review_sections",
                "title": "Clear review-required sections",
                "status": "current",
                "detail": "Review-required sections still need operator cleanup before the preparation handoff is fully ready.",
            },
            {
                "key": "preparation_handoff",
                "title": "Hand off controlled preparation",
                "status": "upcoming",
                "detail": "Preparation becomes the next safe stage once review-required sections are settled.",
            },
        ]
    else:
        workflow_focus = "The flow is ready to move from review into controlled preparation handoff."
        workflow_steps = [
            {
                "key": "dry_run",
                "title": "Validate restore bundle",
                "status": "complete",
                "detail": "Dry-run already ran and no blocked or review-required sections remain in the current plan.",
            },
            {
                "key": "import_review",
                "title": "Review import scope",
                "status": "complete",
                "detail": "Import review already confirmed the safe scope and non-apply boundary.",
            },
            {
                "key": "preparation_handoff",
                "title": "Hand off controlled preparation",
                "status": "current",
                "detail": "Preparation handoff is now the active next step for this bundle.",
            },
            {
                "key": "future_apply",
                "title": "Wait for future controlled apply flow",
                "status": "upcoming",
                "detail": "Live restore apply still stays outside the current product boundary.",
            },
        ]
    workflow_summary = " -> ".join(step["title"] for step in workflow_steps)
    reviewer_guidance = (
        "This plan is for operator review only. It narrows future import scope without authorizing any live restore apply."
    )
    typed_confirmation_phrase = f"review import plan {report.manifest.bundle_name}"

    return RestoreImportPlanResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        dry_run_generated_at=report.generated_at,
        manifest=report.manifest,
        summary=RestoreImportPlanSummary(
            plan_id=f"import-plan-{uuid.uuid4().hex[:12]}",
            plan_status=plan_status,
            apply_allowed=False,
            apply_block_reason=apply_block_reason,
            boundary_message=boundary_message,
            apply_readiness_status=apply_readiness_status,
            apply_readiness_summary=apply_readiness_summary,
            acknowledgement_items=acknowledgement_items,
            typed_review_phrase=typed_review_phrase,
            plan_scope_summary=plan_scope_summary,
            reviewer_guidance=reviewer_guidance,
            typed_confirmation_phrase=typed_confirmation_phrase,
            included_sections=included_sections,
            review_sections=review_sections,
            blocked_sections=blocked_sections,
            excluded_sections=excluded_sections,
            approval_status=approval_status,
            approval_packet_title=approval_packet_title,
            approval_subject_line=approval_subject_line,
            approval_share_summary=approval_share_summary,
            approval_summary=approval_summary,
            approval_decision_question=approval_decision_question,
            approval_checklist=approval_checklist,
            approval_handoff_note=approval_handoff_note,
            approval_next_step=approval_next_step,
            preparation_status=preparation_status,
            preparation_packet_title=preparation_packet_title,
            preparation_share_summary=preparation_share_summary,
            preparation_summary=preparation_summary,
            preparation_checklist=preparation_checklist,
            preparation_handoff_note=preparation_handoff_note,
            preparation_next_step=preparation_next_step,
            workflow_focus=workflow_focus,
            workflow_summary=workflow_summary,
            workflow_steps=workflow_steps,
        ),
        sections=sections,
    )


def _get_bundle_section_items(data_raw: dict, section_name: str) -> list[dict]:
    raw_items = data_raw.get(section_name)
    if raw_items is None:
        return []
    if not isinstance(raw_items, list):
        raise HTTPException(
            status_code=400,
            detail=f'Bundle data section "{section_name}" must be a list.',
        )
    return raw_items


def _collect_item_ids(items: list[dict]) -> set[str]:
    return {item.get("id") for item in items if item.get("id")}


def _has_known_reference(reference_id: str | None, incoming_ids: set[str], current_ids: set[str]) -> bool:
    if not reference_id:
        return False
    return reference_id in incoming_ids or reference_id in current_ids


def _append_manifest_section_issues(
    *,
    section: RestoreDryRunSection,
    manifest_sections: dict[str, int],
    incoming_count: int,
) -> None:
    expected_count = manifest_sections.get(section.name)
    if expected_count is None:
        section.warnings.append(
            _issue(
                "warn",
                "manifest_section_missing",
                f'Manifest does not include section "{section.name}".',
            )
        )
        return
    if expected_count != incoming_count:
        section.warnings.append(
            _issue(
                "warn",
                "manifest_count_mismatch",
                f'Manifest says {expected_count} record(s) for "{section.name}" but bundle data contains {incoming_count}.',
            )
        )


def _analyze_restore_bundle(bundle: dict) -> RestoreDryRunResponse:
    manifest_raw = bundle.get("manifest")
    data_raw = bundle.get("data")

    if not isinstance(manifest_raw, dict):
        raise HTTPException(status_code=400, detail="Bundle manifest is missing or invalid.")
    if not isinstance(data_raw, dict):
        raise HTTPException(status_code=400, detail="Bundle data is missing or invalid.")

    manifest = BackupBundleManifest(**manifest_raw)
    manifest_sections = manifest.sections or {}
    unknown_manifest_sections = sorted(
        name for name in manifest_sections.keys() if name not in EXPECTED_BACKUP_SECTION_NAMES
    )
    unknown_data_sections = sorted(
        name for name in data_raw.keys() if name not in EXPECTED_BACKUP_SECTION_NAMES
    )

    current_users = list_users()
    current_upgrade_requests = list_upgrade_requests()
    current_audit_events = list_admin_audit_events(limit=1000)
    current_servers = list_servers()
    current_deployments = list_deployment_records()
    current_templates = list_deployment_templates()
    current_user_ids = _collect_item_ids(current_users)
    current_server_ids = _collect_item_ids(current_servers)
    current_template_ids = _collect_item_ids(current_templates)

    sections: list[RestoreDryRunSection] = []

    incoming_users = _get_bundle_section_items(data_raw, "users")
    incoming_user_ids = _collect_item_ids(incoming_users)
    section = RestoreDryRunSection(
        name="users",
        incoming_count=len(incoming_users),
        current_count=len(current_users),
    )
    _append_manifest_section_issues(
        section=section,
        manifest_sections=manifest_sections,
        incoming_count=len(incoming_users),
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
    sections.append(_apply_restore_preparation_guidance(_finalize_section(section)))

    incoming_requests = _get_bundle_section_items(data_raw, "upgrade_requests")
    section = RestoreDryRunSection(
        name="upgrade_requests",
        incoming_count=len(incoming_requests),
        current_count=len(current_upgrade_requests),
    )
    _append_manifest_section_issues(
        section=section,
        manifest_sections=manifest_sections,
        incoming_count=len(incoming_requests),
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
        target_user_id = item.get("target_user_id")
        if target_user_id and not _has_known_reference(target_user_id, incoming_user_ids, current_user_ids):
            section.warnings.append(
                _issue(
                    "warn",
                    "target_user_missing",
                    f'Upgrade request "{request_id}" points to missing target_user_id "{target_user_id}".',
                )
            )
        handled_by_user_id = item.get("handled_by_user_id")
        if handled_by_user_id and not _has_known_reference(handled_by_user_id, incoming_user_ids, current_user_ids):
            section.warnings.append(
                _issue(
                    "warn",
                    "handled_by_user_missing",
                    f'Upgrade request "{request_id}" points to missing handled_by_user_id "{handled_by_user_id}".',
                )
            )
    section.notes.append("Upgrade requests can usually be restored after ID and linking review.")
    sections.append(_apply_restore_preparation_guidance(_finalize_section(section)))

    incoming_audit = _get_bundle_section_items(data_raw, "audit_events")
    section = RestoreDryRunSection(
        name="audit_events",
        incoming_count=len(incoming_audit),
        current_count=len(current_audit_events),
    )
    _append_manifest_section_issues(
        section=section,
        manifest_sections=manifest_sections,
        incoming_count=len(incoming_audit),
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
    sections.append(_apply_restore_preparation_guidance(_finalize_section(section)))

    incoming_servers = _get_bundle_section_items(data_raw, "servers")
    incoming_server_ids = _collect_item_ids(incoming_servers)
    section = RestoreDryRunSection(
        name="servers",
        incoming_count=len(incoming_servers),
        current_count=len(current_servers),
    )
    _append_manifest_section_issues(
        section=section,
        manifest_sections=manifest_sections,
        incoming_count=len(incoming_servers),
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
    sections.append(_apply_restore_preparation_guidance(_finalize_section(section)))

    incoming_templates = _get_bundle_section_items(data_raw, "templates")
    incoming_template_ids = _collect_item_ids(incoming_templates)
    section = RestoreDryRunSection(
        name="templates",
        incoming_count=len(incoming_templates),
        current_count=len(current_templates),
    )
    _append_manifest_section_issues(
        section=section,
        manifest_sections=manifest_sections,
        incoming_count=len(incoming_templates),
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
        server_id = item.get("server_id")
        if server_id and not _has_known_reference(server_id, incoming_server_ids, current_server_ids):
            section.warnings.append(
                _issue(
                    "warn",
                    "template_server_missing",
                    f'Template "{name}" points to missing server_id "{server_id}".',
                )
            )
    section.notes.append("Templates are good restore candidates after conflict cleanup.")
    sections.append(_apply_restore_preparation_guidance(_finalize_section(section)))

    incoming_deployments = _get_bundle_section_items(data_raw, "deployments")
    section = RestoreDryRunSection(
        name="deployments",
        incoming_count=len(incoming_deployments),
        current_count=len(current_deployments),
    )
    _append_manifest_section_issues(
        section=section,
        manifest_sections=manifest_sections,
        incoming_count=len(incoming_deployments),
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
        server_id = item.get("server_id")
        if server_id and not _has_known_reference(server_id, incoming_server_ids, current_server_ids):
            section.blockers.append(
                _issue(
                    "error",
                    "deployment_server_missing",
                    f'Deployment "{container_name}" points to missing server_id "{server_id}".',
                )
            )
        template_id = item.get("template_id")
        if template_id and not _has_known_reference(template_id, incoming_template_ids, current_template_ids):
            section.warnings.append(
                _issue(
                    "warn",
                    "deployment_template_missing",
                    f'Deployment "{container_name}" points to missing template_id "{template_id}".',
                )
            )
        external_port = item.get("external_port")
        if external_port is not None:
            port_key = f'{item.get("server_id") or "local"}:{external_port}'
            if port_key in seen_ports:
                section.blockers.append(_issue("error", "duplicate_port_bundle", f'Bundle contains duplicate external port "{external_port}" on the same target.'))
            seen_ports.add(port_key)
            if port_key in current_ports and current_ports[port_key].get("id") != item.get("id"):
                section.blockers.append(_issue("error", "deployment_port_conflict", f'External port "{external_port}" is already used on the target environment.'))
    section.notes.append("Deployment restore is runtime-sensitive and should stay dry-run only for now.")
    sections.append(_apply_restore_preparation_guidance(_finalize_section(section)))

    total_records = sum(section.incoming_count for section in sections)

    if unknown_manifest_sections:
        sections[0].warnings.append(
            _issue(
                "warn",
                "unknown_manifest_sections",
                f'Manifest includes unknown section(s): {", ".join(unknown_manifest_sections)}.',
            )
        )
    if unknown_data_sections:
        sections[0].warnings.append(
            _issue(
                "warn",
                "unknown_data_sections",
                f'Bundle data includes unknown section(s): {", ".join(unknown_data_sections)}.',
            )
        )
    if not manifest.version.startswith("2026-04-01.backup-bundle.v1"):
        sections[0].warnings.append(
            _issue(
                "warn",
                "bundle_version_unrecognized",
                f'Bundle version "{manifest.version}" is not the current expected backup format.',
            )
        )
    sections[0] = _apply_restore_preparation_guidance(_finalize_section(sections[0]))

    blocker_count = sum(len(section.blockers) for section in sections)
    warning_count = sum(len(section.warnings) for section in sections)
    ok_sections = sum(1 for section in sections if section.status == "ok")
    review_required_sections = sum(1 for section in sections if section.status == "warn")
    blocked_sections = sum(1 for section in sections if section.status == "error")
    readiness_status, next_step, plain_language_summary, highest_risk_sections = _build_restore_readiness_summary(
        sections
    )
    (
        preparation_summary,
        validate_only_sections,
        merge_review_sections,
        prepare_import_sections,
        dry_run_only_sections,
    ) = _build_restore_preparation_summary(sections)

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
            readiness_status=readiness_status,
            next_step=next_step,
            plain_language_summary=plain_language_summary,
            highest_risk_sections=highest_risk_sections,
            preparation_summary=preparation_summary,
            validate_only_sections=validate_only_sections,
            merge_review_sections=merge_review_sections,
            prepare_import_sections=prepare_import_sections,
            dry_run_only_sections=dry_run_only_sections,
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
    "/admin/restore/import-plan",
    response_model=RestoreImportPlanResponse,
    dependencies=[Depends(require_admin)],
)
def build_restore_import_plan(payload: RestoreDryRunRequest) -> RestoreImportPlanResponse:
    return _build_restore_import_plan(_analyze_restore_bundle(payload.bundle))


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
