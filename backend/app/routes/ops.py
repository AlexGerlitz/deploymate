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
    OpsReleaseChecklistItem,
    OpsReleaseIncidentSummary,
    OpsReleaseMaintenanceSummary,
    OpsReleaseRepairStep,
    OpsReleaseRepairWorkflowResponse,
    OpsReleaseRepairWorkflowStep,
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
RELEASE_SECRETS_AUDIT_COMMAND = (
    "gh workflow run release-secrets-audit.yml --repo AlexGerlitz/deploymate --ref develop"
)


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


def _open_release_incidents(
    production: OpsReleaseIncidentSummary,
    staging: OpsReleaseIncidentSummary,
) -> list[OpsReleaseIncidentSummary]:
    return [incident for incident in (production, staging) if incident.state != "CLOSED"]


def _release_incident_label(incidents: list[OpsReleaseIncidentSummary]) -> str:
    if not incidents:
        return "release incidents"
    return ", ".join(f"{item.environment} #{item.issue_number}" for item in incidents)


def _incident_checklist_item(incident: OpsReleaseIncidentSummary) -> OpsReleaseChecklistItem:
    if incident.state == "CLOSED":
        return OpsReleaseChecklistItem(
            key=f"{incident.environment}-incident",
            label=f"{incident.environment.title()} incident",
            status="ok",
            detail=f"Issue #{incident.issue_number} is closed.",
        )

    if incident.state == "OPEN":
        category = incident.failure_category or "unavailable"
        return OpsReleaseChecklistItem(
            key=f"{incident.environment}-incident",
            label=f"{incident.environment.title()} incident",
            status="blocked",
            detail=f"Issue #{incident.issue_number} is open with category {category}.",
        )

    return OpsReleaseChecklistItem(
        key=f"{incident.environment}-incident",
        label=f"{incident.environment.title()} incident",
        status="unknown",
        detail=f"Issue #{incident.issue_number} state is {incident.state or 'unknown'}.",
    )


def _build_release_checklist(
    *,
    available: bool,
    ready_for_unpause: bool,
    release_audit_scheduled_paused: bool,
    staging_release_paused: bool,
    network_checks: str,
    production: OpsReleaseIncidentSummary,
    staging: OpsReleaseIncidentSummary,
) -> list[OpsReleaseChecklistItem]:
    if not available:
        return [
            OpsReleaseChecklistItem(
                key="release-status-json",
                label="Release status JSON",
                status="unknown",
                detail="Runtime is not connected to the generated release maintenance status file.",
            )
        ]

    open_incidents = _open_release_incidents(production, staging)
    open_categories = {incident.failure_category for incident in open_incidents}
    ssh_auth_blocked = "ssh_auth_denied" in open_categories
    host_key_blocked = "ssh_host_key_changed" in open_categories

    checklist = [
        OpsReleaseChecklistItem(
            key="scheduled-audit-pause",
            label="Scheduled audit pause",
            status="blocked" if release_audit_scheduled_paused else "ok",
            detail=(
                "Scheduled release audit is paused until a manual audit succeeds."
                if release_audit_scheduled_paused
                else "Scheduled release audit is allowed to run."
            ),
        ),
        OpsReleaseChecklistItem(
            key="staging-release-pause",
            label="Staging release pause",
            status="blocked" if staging_release_paused else "ok",
            detail=(
                "Automatic staging release is paused until the release audit is repaired."
                if staging_release_paused
                else "Automatic staging release is not paused."
            ),
        ),
        _incident_checklist_item(production),
        _incident_checklist_item(staging),
    ]

    if host_key_blocked:
        checklist.extend(
            [
                OpsReleaseChecklistItem(
                    key="ssh-trust-anchor",
                    label="SSH trust anchor",
                    status="blocked",
                    detail="The deploy host fingerprint changed; confirm and repin known_hosts before deploy.",
                ),
                OpsReleaseChecklistItem(
                    key="deploy-key",
                    label="Deploy key",
                    status="unknown",
                    detail="Deploy key verification waits until the SSH trust anchor is repaired.",
                ),
            ]
        )
    elif ssh_auth_blocked:
        checklist.extend(
            [
                OpsReleaseChecklistItem(
                    key="ssh-trust-anchor",
                    label="SSH trust anchor",
                    status="ok",
                    detail="The pinned known_hosts trust check already passed; do not rotate it for this blocker.",
                ),
                OpsReleaseChecklistItem(
                    key="deploy-key",
                    label="Deploy key",
                    status="blocked",
                    detail="The deploy host rejects the GitHub deploy key; repair authorized_keys or rotate the secret.",
                ),
            ]
        )
    elif ready_for_unpause:
        checklist.extend(
            [
                OpsReleaseChecklistItem(
                    key="ssh-trust-anchor",
                    label="SSH trust anchor",
                    status="ok",
                    detail="No release incident is currently blocking SSH trust.",
                ),
                OpsReleaseChecklistItem(
                    key="deploy-key",
                    label="Deploy key",
                    status="ok",
                    detail="No release incident is currently blocking deploy authentication.",
                ),
            ]
        )
    else:
        checklist.extend(
            [
                OpsReleaseChecklistItem(
                    key="ssh-trust-anchor",
                    label="SSH trust anchor",
                    status="unknown",
                    detail="Review the current incident category before changing host trust.",
                ),
                OpsReleaseChecklistItem(
                    key="deploy-key",
                    label="Deploy key",
                    status="unknown",
                    detail="Review the current incident category before changing deploy keys.",
                ),
            ]
        )

    checklist.append(
        OpsReleaseChecklistItem(
            key="public-network-check",
            label="Public network check",
            status="warn" if network_checks == "skipped" else "ok" if network_checks == "enabled" else "unknown",
            detail=(
                "DNS and HTTPS probes were skipped for this status snapshot."
                if network_checks == "skipped"
                else "DNS and HTTPS probes were included in this status snapshot."
                if network_checks == "enabled"
                else f"Network check state is {network_checks or 'unknown'}."
            ),
        )
    )

    return checklist


def _build_release_repair_playbook(
    *,
    available: bool,
    ready_for_unpause: bool,
    production: OpsReleaseIncidentSummary,
    staging: OpsReleaseIncidentSummary,
    primary_blocker: str | None,
) -> list[OpsReleaseRepairStep]:
    if not available:
        return [
            OpsReleaseRepairStep(
                key="publish-status-json",
                title="Publish release status JSON",
                detail=(
                    "Run scripts/sync_release_maintenance_status.sh on a trusted runner and point "
                    "DEPLOYMATE_RELEASE_MAINTENANCE_STATUS_FILE at the generated JSON file."
                ),
            )
        ]

    open_incidents = _open_release_incidents(production, staging)
    incident_label = _release_incident_label(open_incidents)
    open_categories = {incident.failure_category for incident in open_incidents}

    if ready_for_unpause:
        return [
            OpsReleaseRepairStep(
                key="planned-unpause",
                title="Unpause only in a planned release window",
                detail=(
                    "The maintenance check is ready. Remove release pauses only when an operator is "
                    "watching the next release or scheduled audit run."
                ),
            )
        ]

    if "ssh_auth_denied" in open_categories:
        return [
            OpsReleaseRepairStep(
                key="keep-trust-anchor",
                title="Keep known_hosts unchanged",
                detail=(
                    "This category means SSH host trust already passed. Do not rotate the host "
                    "fingerprint unless a separate host-key incident appears."
                ),
            ),
            OpsReleaseRepairStep(
                key="restore-deploy-key",
                title="Restore the deploy public key",
                detail=(
                    f"Repair {incident_label}: install the matching public key in authorized_keys "
                    "for the deploy user, or rotate the GitHub environment DEPLOY_SSH_PRIVATE_KEY."
                ),
            ),
            OpsReleaseRepairStep(
                key="rerun-release-audit",
                title="Rerun Release Secrets Audit manually",
                detail=(
                    "Keep scheduled audit and staging pauses enabled until the manual audit proves "
                    "the key works."
                ),
            ),
            OpsReleaseRepairStep(
                key="close-and-unpause",
                title="Close incidents and remove pauses after green audit",
                detail=(
                    "Close the GitHub incident issues and unset the pause variables only after the "
                    "manual audit succeeds for the affected environments."
                ),
            ),
        ]

    if open_incidents:
        first_hint = next((incident.operator_hint for incident in open_incidents if incident.operator_hint), "")
        return [
            OpsReleaseRepairStep(
                key="read-incident-diagnostics",
                title="Read the latest incident diagnostics",
                detail=f"Start with {incident_label}; the current blocker category is captured in the issue body.",
            ),
            OpsReleaseRepairStep(
                key="apply-operator-hint",
                title="Apply the operator hint",
                detail=first_hint or "Use the failure category and workflow logs to repair the environment.",
            ),
            OpsReleaseRepairStep(
                key="rerun-release-audit",
                title="Rerun Release Secrets Audit manually",
                detail="Do not remove pauses until a manual audit run succeeds.",
            ),
        ]

    if primary_blocker:
        return [
            OpsReleaseRepairStep(
                key="resolve-primary-blocker",
                title="Resolve the primary release blocker",
                detail=f"Clear this blocker before unpausing release automation: {primary_blocker}.",
            )
        ]

    return [
        OpsReleaseRepairStep(
            key="rerun-maintenance-check",
            title="Rerun maintenance status",
            detail="Refresh the release maintenance status and review the generated blockers before unpausing.",
        )
    ]


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
        production = OpsReleaseIncidentSummary(environment="production", issue_number=18)
        staging = OpsReleaseIncidentSummary(environment="staging", issue_number=19)
        return OpsReleaseMaintenanceSummary(
            available=False,
            source=source,
            next_step=(
                "Publish the latest release-maintenance-status JSON to the runtime before using "
                "release unpause decisions."
            ),
            checklist=_build_release_checklist(
                available=False,
                ready_for_unpause=False,
                release_audit_scheduled_paused=False,
                staging_release_paused=False,
                network_checks="unknown",
                production=production,
                staging=staging,
            ),
            repair_playbook=_build_release_repair_playbook(
                available=False,
                ready_for_unpause=False,
                production=production,
                staging=staging,
                primary_blocker=None,
            ),
            production=production,
            staging=staging,
        )

    blocker_count = _int_status_value(payload, "blocker_count")
    production = _release_incident_summary(payload, environment="production", issue_number=18)
    staging = _release_incident_summary(payload, environment="staging", issue_number=19)
    primary_blocker = _first_release_blocker(payload, blocker_count)
    ready_for_unpause = _bool_status_value(payload, "ready_for_unpause")
    release_audit_scheduled_paused = _bool_status_value(payload, "release_audit_scheduled_paused")
    staging_release_paused = _bool_status_value(payload, "staging_release_paused")
    network_checks = _string_value(payload, "network_checks", "unknown")
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
        ready_for_unpause=ready_for_unpause,
        release_audit_scheduled_paused=release_audit_scheduled_paused,
        staging_release_paused=staging_release_paused,
        network_checks=network_checks,
        blocker_count=blocker_count,
        primary_blocker=primary_blocker,
        next_step=next_step,
        checklist=_build_release_checklist(
            available=True,
            ready_for_unpause=ready_for_unpause,
            release_audit_scheduled_paused=release_audit_scheduled_paused,
            staging_release_paused=staging_release_paused,
            network_checks=network_checks,
            production=production,
            staging=staging,
        ),
        repair_playbook=_build_release_repair_playbook(
            available=True,
            ready_for_unpause=ready_for_unpause,
            production=production,
            staging=staging,
            primary_blocker=primary_blocker,
        ),
        production=production,
        staging=staging,
    )


def _release_checklist_by_key(
    release_maintenance: OpsReleaseMaintenanceSummary,
) -> dict[str, OpsReleaseChecklistItem]:
    return {item.key: item for item in release_maintenance.checklist}


def _release_status_from_item(
    checklist: dict[str, OpsReleaseChecklistItem],
    key: str,
    *,
    ok_status: str = "complete",
    unknown_status: str = "pending",
) -> str:
    item = checklist.get(key)
    if item is None:
        return unknown_status
    if item.status == "ok":
        return ok_status
    if item.status == "blocked":
        return "blocked"
    if item.status == "warn":
        return "current"
    return unknown_status


def _build_release_repair_workflow_steps(
    release_maintenance: OpsReleaseMaintenanceSummary,
    *,
    phase: str,
) -> list[OpsReleaseRepairWorkflowStep]:
    checklist = _release_checklist_by_key(release_maintenance)
    deploy_key_status = checklist.get("deploy-key")

    status_json_status = "complete" if release_maintenance.available else "current"
    pause_guard_status = (
        "complete"
        if release_maintenance.release_audit_scheduled_paused or release_maintenance.staging_release_paused
        else "pending"
    )
    host_trust_status = _release_status_from_item(checklist, "ssh-trust-anchor")
    deploy_key_step_status = _release_status_from_item(checklist, "deploy-key")
    if deploy_key_status and deploy_key_status.status == "blocked":
        deploy_key_step_status = "current"

    host_trust_item = checklist.get("ssh-trust-anchor") or OpsReleaseChecklistItem(
        key="ssh-trust-anchor",
        label="SSH trust anchor",
        status="unknown",
        detail="SSH trust anchor state is not present in the checklist.",
    )
    deploy_key_item = checklist.get("deploy-key") or OpsReleaseChecklistItem(
        key="deploy-key",
        label="Deploy key",
        status="unknown",
        detail="Deploy key state is not present in the checklist.",
    )

    manual_audit_status = "pending"
    close_status = "pending"
    if phase == "ready_for_manual_audit":
        manual_audit_status = "current"
    elif phase == "ready_for_unpause":
        manual_audit_status = "complete"
        close_status = "current"
    elif phase == "status_unwired":
        manual_audit_status = "blocked"

    return [
        OpsReleaseRepairWorkflowStep(
            key="status-json",
            title="Release status is connected",
            status=status_json_status,
            detail=(
                f"Status source is {release_maintenance.source}."
                if release_maintenance.available
                else "Runtime does not see the generated release maintenance status JSON yet."
            ),
            operator_action=(
                "Keep using this status snapshot for release decisions."
                if release_maintenance.available
                else "Run the maintenance status sync and set DEPLOYMATE_RELEASE_MAINTENANCE_STATUS_FILE."
            ),
        ),
        OpsReleaseRepairWorkflowStep(
            key="pause-guard",
            title="Release pauses stay active",
            status=pause_guard_status,
            detail=(
                "Scheduled audit or staging release is paused while repair evidence is collected."
                if pause_guard_status == "complete"
                else "Release pauses are not active in the current snapshot."
            ),
            operator_action="Keep pauses enabled until a manual release audit succeeds.",
        ),
        OpsReleaseRepairWorkflowStep(
            key="ssh-trust-anchor",
            title="SSH trust anchor is verified",
            status=host_trust_status,
            detail=host_trust_item.detail,
            operator_action="Do not rotate known_hosts unless the incident category changes to host-key failure.",
        ),
        OpsReleaseRepairWorkflowStep(
            key="restore-deploy-key",
            title="Deploy key can authenticate",
            status=deploy_key_step_status,
            detail=deploy_key_item.detail,
            operator_action=(
                "Install the matching public key in authorized_keys or rotate DEPLOY_SSH_PRIVATE_KEY."
                if deploy_key_step_status in {"current", "blocked"}
                else "Keep the current deploy key contract unchanged."
            ),
        ),
        OpsReleaseRepairWorkflowStep(
            key="manual-audit-rerun",
            title="Manual Release Secrets Audit is green",
            status=manual_audit_status,
            detail="The release audit must prove SSH auth before pauses can be removed.",
            operator_action=RELEASE_SECRETS_AUDIT_COMMAND,
        ),
        OpsReleaseRepairWorkflowStep(
            key="close-and-unpause",
            title="Incidents are closed and pauses are removed",
            status=close_status,
            detail="Close GitHub incident issues and remove pause variables only after green evidence.",
            operator_action="Schedule a watched release window, close incidents, then remove release pauses.",
        ),
    ]


def _build_release_repair_handoff(
    *,
    generated_at: str,
    phase: str,
    status: str,
    summary: str,
    next_action: str,
    typed_confirmation_phrase: str,
    checklist: list[OpsReleaseChecklistItem],
    steps: list[OpsReleaseRepairWorkflowStep],
) -> str:
    lines = [
        "# Release Repair Handoff",
        "",
        f"- Generated: {generated_at}",
        f"- Phase: {phase}",
        f"- Status: {status}",
        f"- Summary: {summary}",
        f"- Next action: {next_action}",
        f"- Manual audit: `{RELEASE_SECRETS_AUDIT_COMMAND}`",
        f"- Confirmation phrase: `{typed_confirmation_phrase}`",
        "",
        "## Readiness Checklist",
    ]
    lines.extend(f"- [{item.status}] {item.label}: {item.detail}" for item in checklist)
    lines.extend(["", "## Operator Steps"])
    lines.extend(
        f"{index}. [{step.status}] {step.title}: {step.operator_action}"
        for index, step in enumerate(steps, start=1)
    )
    return "\n".join(lines)


def _build_release_repair_workflow() -> OpsReleaseRepairWorkflowResponse:
    release_maintenance = _build_release_maintenance_summary()
    generated_at = datetime.now(timezone.utc).isoformat()
    checklist = release_maintenance.checklist
    checklist_by_key = _release_checklist_by_key(release_maintenance)
    deploy_key_status = checklist_by_key.get("deploy-key")
    blocked_items = [item for item in checklist if item.status == "blocked"]
    open_incidents = _open_release_incidents(
        release_maintenance.production,
        release_maintenance.staging,
    )

    if not release_maintenance.available:
        phase = "status_unwired"
        status = "review"
        summary = "Release maintenance status is not connected to this runtime."
        next_action = release_maintenance.next_step
        typed_confirmation_phrase = "confirm release status sync"
    elif release_maintenance.ready_for_unpause:
        phase = "ready_for_unpause"
        status = "ready"
        summary = "Release maintenance is ready for a planned unpause window."
        next_action = "Schedule a watched release window before removing audit and staging pauses."
        typed_confirmation_phrase = "confirm planned release unpause"
    elif deploy_key_status and deploy_key_status.status == "blocked":
        phase = "repair_required"
        status = "blocked"
        summary = "Release automation is blocked because the deploy host rejects the GitHub deploy key."
        next_action = (
            "Restore the deploy public key in authorized_keys or rotate DEPLOY_SSH_PRIVATE_KEY, "
            "then rerun Release Secrets Audit manually."
        )
        typed_confirmation_phrase = "confirm deploy key repair before audit"
    elif blocked_items or open_incidents:
        phase = "repair_required"
        status = "blocked"
        summary = "Release automation still has open blockers before unpause."
        next_action = release_maintenance.next_step
        typed_confirmation_phrase = "confirm release blocker repair"
    else:
        phase = "ready_for_manual_audit"
        status = "review"
        summary = "No blocking checklist item remains; manual audit evidence is needed next."
        next_action = f"Run `{RELEASE_SECRETS_AUDIT_COMMAND}` and attach the result to the release incidents."
        typed_confirmation_phrase = "confirm manual release audit"

    steps = _build_release_repair_workflow_steps(release_maintenance, phase=phase)
    audit_trail = [
        f"generated_at={generated_at}",
        f"source={release_maintenance.source}",
        f"phase={phase}",
        f"status={status}",
        f"ready_for_unpause={release_maintenance.ready_for_unpause}",
        f"blocker_count={release_maintenance.blocker_count}",
        (
            f"production_issue=#{release_maintenance.production.issue_number} "
            f"state={release_maintenance.production.state} "
            f"category={release_maintenance.production.failure_category}"
        ),
        (
            f"staging_issue=#{release_maintenance.staging.issue_number} "
            f"state={release_maintenance.staging.state} "
            f"category={release_maintenance.staging.failure_category}"
        ),
    ]

    return OpsReleaseRepairWorkflowResponse(
        generated_at=generated_at,
        phase=phase,
        status=status,
        summary=summary,
        next_action=next_action,
        typed_confirmation_phrase=typed_confirmation_phrase,
        manual_audit_command=RELEASE_SECRETS_AUDIT_COMMAND,
        handoff_markdown=_build_release_repair_handoff(
            generated_at=generated_at,
            phase=phase,
            status=status,
            summary=summary,
            next_action=next_action,
            typed_confirmation_phrase=typed_confirmation_phrase,
            checklist=checklist,
            steps=steps,
        ),
        audit_trail=audit_trail,
        checklist=checklist,
        steps=steps,
        release_maintenance=release_maintenance,
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


@router.get("/release-repair-workflow", response_model=OpsReleaseRepairWorkflowResponse)
def get_release_repair_workflow(user=Depends(require_auth)) -> OpsReleaseRepairWorkflowResponse:
    if not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Release repair workflow is admin-only.")
    return _build_release_repair_workflow()


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
