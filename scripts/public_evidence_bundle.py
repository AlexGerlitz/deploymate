#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
RELEASE_SECRETS_AUDIT_WORKFLOW = "release-secrets-audit.yml"
DEPLOY_KEY_RECOVERY_WORKFLOW = "deploy-key-recovery.yml"
ISSUE_COMMENT_MARKER = "<!-- deploymate:release-repair-evidence -->"
PRIMARY_LIVE_URL = "https://deploymatecloud.ru"
FALLBACK_LIVE_URL = "https://deploymate.152.53.178.83.sslip.io"
FALLBACK_REVIEW_URL = f"{FALLBACK_LIVE_URL}/review"


def run_command(args: list[str], *, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def git_value(*args: str, default: str = "unavailable") -> str:
    result = run_command(["git", *args])
    if result.returncode != 0:
        return default
    value = result.stdout.strip()
    return value or default


def load_maintenance_status(repo: str, check_network: bool) -> dict[str, str]:
    args = [
        "bash",
        "scripts/release_maintenance_status.sh",
        "--repo",
        repo,
        "--format",
        "json",
    ]
    if not check_network:
        args.append("--no-network")

    result = run_command(args)
    if result.returncode != 0:
        return {
            "available": "0",
            "error": (result.stderr or result.stdout or "maintenance status failed").strip(),
        }

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        return {
            "available": "0",
            "error": f"maintenance status json parse failed: {exc}",
        }

    payload["available"] = "1"
    return payload


def load_github_runs(repo: str, branch: str) -> list[dict[str, Any]]:
    if shutil.which("gh") is None:
        return []

    result = run_command(
        [
            "gh",
            "run",
            "list",
            "--repo",
            repo,
            "--branch",
            branch,
            "--limit",
            "25",
            "--json",
            "databaseId,workflowName,status,conclusion,event,headSha,displayTitle,createdAt,url",
        ]
    )
    if result.returncode != 0:
        return []

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []

    return payload if isinstance(payload, list) else []


def latest_workflow(runs: list[dict[str, Any]], workflow_name: str) -> dict[str, Any]:
    for run in runs:
        if run.get("workflowName") == workflow_name and run.get("status") == "completed":
            return run
    for run in runs:
        if run.get("workflowName") == workflow_name:
            return run
    return {
        "workflowName": workflow_name,
        "status": "unavailable",
        "conclusion": "unavailable",
        "url": "",
        "databaseId": "",
        "headSha": "",
        "displayTitle": "",
        "event": "",
        "createdAt": "",
    }


def release_secrets_audit_command(repo: str, branch: str) -> str:
    return f"gh workflow run {RELEASE_SECRETS_AUDIT_WORKFLOW} --repo {repo} --ref {branch}"


def gh_api_json(
    *,
    repo: str,
    endpoint: str,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> Any:
    if shutil.which("gh") is None:
        raise RuntimeError("gh CLI is required to publish issue comments")

    owner_repo = repo.strip()
    if "/" not in owner_repo:
        raise RuntimeError(f"repo must use owner/name format, got {repo!r}")

    args = ["gh", "api", f"repos/{owner_repo}/{endpoint}", "--method", method]
    temp_path = None
    try:
        if payload is not None:
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as handle:
                json.dump(payload, handle)
                temp_path = handle.name
            args.extend(["--input", temp_path])

        result = run_command(args)
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)

    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "gh api failed").strip())
    if not result.stdout.strip():
        return {}
    return json.loads(result.stdout)


def build_bundle(repo: str, branch: str, check_network: bool) -> dict[str, Any]:
    runs = load_github_runs(repo, branch)
    maintenance = load_maintenance_status(repo, check_network)
    commit = os.getenv("GITHUB_SHA") or git_value("rev-parse", "HEAD")
    current_branch = branch or os.getenv("GITHUB_REF_NAME") or git_value("rev-parse", "--abbrev-ref", "HEAD")
    maintenance["network_blockers"] = network_blockers(maintenance)
    maintenance["checklist"] = build_release_checklist(maintenance)
    maintenance["repair_playbook"] = build_repair_playbook(maintenance)
    maintenance["repair_workflow"] = build_repair_workflow(
        maintenance,
        repo=repo,
        branch=current_branch,
    )

    selected_workflows = {
        "ci": latest_workflow(runs, "CI"),
        "release_maintenance_status": latest_workflow(runs, "Release Maintenance Status"),
        "release_secrets_audit": latest_workflow(runs, "Release Secrets Audit"),
        "deploy_key_recovery": latest_workflow(runs, "Deploy Key Recovery Packet"),
        "public_evidence": latest_workflow(runs, "Public Evidence Bundle"),
        "staging": latest_workflow(runs, "Staging"),
    }

    bundle = {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "repo": repo,
        "branch": current_branch,
        "commit": commit,
        "maintenance": maintenance,
        "workflows": selected_workflows,
        "reviewer_path": [
            FALLBACK_REVIEW_URL,
            "/review",
            "README.md",
            "docs/releases/v0.1.0.md",
            "RUNBOOK.md",
            "SAFE-RELEASE.md",
            "Release Maintenance Status artifact",
            "python3 scripts/export_review_packet.py --output dist/review",
        ],
    }
    bundle["workflows"]["public_evidence"] = current_public_evidence_run(bundle)
    bundle["review_index"] = build_review_index(bundle)
    return bundle


def open_release_incidents(maintenance: dict[str, Any]) -> list[dict[str, str]]:
    incidents = []
    for issue_number, environment in ((18, "production"), (19, "staging")):
        state = str(maintenance.get(f"issue_{issue_number}_state", "unknown"))
        if state == "CLOSED":
            continue
        incidents.append(
            {
                "environment": environment,
                "issue_number": str(issue_number),
                "state": state,
                "failure_category": str(
                    maintenance.get(f"issue_{issue_number}_failure_category", "unknown")
                ),
                "operator_hint": str(maintenance.get(f"issue_{issue_number}_operator_hint", "")),
            }
        )
    return incidents


def release_incidents(maintenance: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {
            "environment": environment,
            "issue_number": str(issue_number),
            "state": str(maintenance.get(f"issue_{issue_number}_state", "unknown")),
            "failure_category": str(
                maintenance.get(f"issue_{issue_number}_failure_category", "unknown")
            ),
            "operator_hint": str(maintenance.get(f"issue_{issue_number}_operator_hint", "")),
        }
        for issue_number, environment in ((18, "production"), (19, "staging"))
    ]


def release_incident_label(incidents: list[dict[str, str]]) -> str:
    if not incidents:
        return "release incidents"
    return ", ".join(f"{item['environment']} #{item['issue_number']}" for item in incidents)


def release_blockers(maintenance: dict[str, Any]) -> list[str]:
    try:
        blocker_count = int(str(maintenance.get("blocker_count", "0") or "0"))
    except ValueError:
        return []
    return [
        str(maintenance.get(f"blocker_{index}", "") or "")
        for index in range(1, blocker_count + 1)
        if str(maintenance.get(f"blocker_{index}", "") or "")
    ]


def network_blockers(maintenance: dict[str, Any]) -> list[str]:
    return [blocker for blocker in release_blockers(maintenance) if blocker.startswith("host ")]


def public_target_repair_step(host_blockers: list[str]) -> dict[str, str]:
    details = "; ".join(host_blockers) if host_blockers else "Public DNS/HTTPS status is unavailable."
    return {
        "key": "restore-public-target",
        "title": "Restore public DNS and HTTPS target",
        "detail": (
            "Repair public target probes before treating the live demo as available: "
            f"{details}."
        ),
    }


def incident_checklist_item(incident: dict[str, str]) -> dict[str, str]:
    environment = incident["environment"]
    issue_number = incident["issue_number"]
    state = incident.get("state", "unknown")
    if state == "CLOSED":
        return {
            "key": f"{environment}-incident",
            "label": f"{environment.title()} incident",
            "status": "ok",
            "detail": f"Issue #{issue_number} is closed.",
        }
    if state == "OPEN":
        category = incident.get("failure_category") or "unavailable"
        return {
            "key": f"{environment}-incident",
            "label": f"{environment.title()} incident",
            "status": "blocked",
            "detail": f"Issue #{issue_number} is open with category {category}.",
        }
    return {
        "key": f"{environment}-incident",
        "label": f"{environment.title()} incident",
        "status": "unknown",
        "detail": f"Issue #{issue_number} state is {state or 'unknown'}.",
    }


def build_release_checklist(maintenance: dict[str, Any]) -> list[dict[str, str]]:
    available = str(maintenance.get("available", "1")).lower() in {"1", "true", "yes", "on"}
    if not available:
        return [
            {
                "key": "release-status-json",
                "label": "Release status JSON",
                "status": "unknown",
                "detail": "Runtime is not connected to the generated release maintenance status file.",
            }
        ]

    ready_for_unpause = str(maintenance.get("ready_for_unpause", "0")).lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    release_audit_paused = str(
        maintenance.get("release_audit_scheduled_paused", "false")
    ).lower() in {"1", "true", "yes", "on"}
    staging_release_paused = str(maintenance.get("staging_release_paused", "false")).lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    network_checks = str(maintenance.get("network_checks", "unknown") or "unknown")
    host_blockers = network_blockers(maintenance)
    all_incidents = release_incidents(maintenance)
    open_incidents = [item for item in all_incidents if item["state"] != "CLOSED"]
    categories = {item["failure_category"] for item in open_incidents}

    checklist = [
        {
            "key": "scheduled-audit-pause",
            "label": "Scheduled audit pause",
            "status": "blocked" if release_audit_paused else "ok",
            "detail": (
                "Scheduled release audit is paused until a manual audit succeeds."
                if release_audit_paused
                else "Scheduled release audit is allowed to run."
            ),
        },
        {
            "key": "staging-release-pause",
            "label": "Staging release pause",
            "status": "blocked" if staging_release_paused else "ok",
            "detail": (
                "Automatic staging release is paused until the release audit is repaired."
                if staging_release_paused
                else "Automatic staging release is not paused."
            ),
        },
    ]
    checklist.extend(incident_checklist_item(incident) for incident in all_incidents)

    if "ssh_host_key_changed" in categories:
        checklist.extend(
            [
                {
                    "key": "ssh-trust-anchor",
                    "label": "SSH trust anchor",
                    "status": "blocked",
                    "detail": "The deploy host fingerprint changed; confirm and repin known_hosts before deploy.",
                },
                {
                    "key": "deploy-key",
                    "label": "Deploy key",
                    "status": "unknown",
                    "detail": "Deploy key verification waits until the SSH trust anchor is repaired.",
                },
            ]
        )
    elif "ssh_auth_denied" in categories:
        checklist.extend(
            [
                {
                    "key": "ssh-trust-anchor",
                    "label": "SSH trust anchor",
                    "status": "ok",
                    "detail": "The pinned known_hosts trust check already passed; do not rotate it for this blocker.",
                },
                {
                    "key": "deploy-key",
                    "label": "Deploy key",
                    "status": "blocked",
                    "detail": "The deploy host rejects the GitHub deploy key; repair authorized_keys or rotate the secret.",
                },
            ]
        )
    elif ready_for_unpause:
        checklist.extend(
            [
                {
                    "key": "ssh-trust-anchor",
                    "label": "SSH trust anchor",
                    "status": "ok",
                    "detail": "No release incident is currently blocking SSH trust.",
                },
                {
                    "key": "deploy-key",
                    "label": "Deploy key",
                    "status": "ok",
                    "detail": "No release incident is currently blocking deploy authentication.",
                },
            ]
        )
    else:
        checklist.extend(
            [
                {
                    "key": "ssh-trust-anchor",
                    "label": "SSH trust anchor",
                    "status": "unknown",
                    "detail": "Review the current incident category before changing host trust.",
                },
                {
                    "key": "deploy-key",
                    "label": "Deploy key",
                    "status": "unknown",
                    "detail": "Review the current incident category before changing deploy keys.",
                },
            ]
        )

    checklist.append(
        {
            "key": "public-network-check",
            "label": "Public network check",
            "status": (
                "warn"
                if network_checks == "skipped"
                else "blocked"
                if host_blockers
                else "ok"
                if network_checks == "enabled"
                else "unknown"
            ),
            "detail": (
                "DNS and HTTPS probes were skipped for this status snapshot."
                if network_checks == "skipped"
                else f"Public host probes are failing: {'; '.join(host_blockers)}."
                if host_blockers
                else "DNS and HTTPS probes were included in this status snapshot."
                if network_checks == "enabled"
                else f"Network check state is {network_checks}."
            ),
        }
    )
    return checklist


def build_repair_playbook(maintenance: dict[str, Any]) -> list[dict[str, str]]:
    available = str(maintenance.get("available", "1")).lower() in {"1", "true", "yes", "on"}
    ready_for_unpause = str(maintenance.get("ready_for_unpause", "0")).lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if not available:
        return [
            {
                "key": "refresh-maintenance-status",
                "title": "Refresh release maintenance status",
                "detail": "Regenerate the maintenance JSON before making release unpause decisions.",
            }
        ]

    incidents = open_release_incidents(maintenance)
    categories = {item["failure_category"] for item in incidents}
    incident_label = release_incident_label(incidents)
    host_blockers = list(maintenance.get("network_blockers") or network_blockers(maintenance))

    if ready_for_unpause:
        return [
            {
                "key": "planned-unpause",
                "title": "Unpause only in a planned release window",
                "detail": "Remove pause variables only while an operator is watching the next audit or deploy.",
            }
        ]

    if "ssh_auth_denied" in categories:
        steps = [
            {
                "key": "keep-trust-anchor",
                "title": "Keep known_hosts unchanged",
                "detail": "SSH host trust already passed; repair the deploy key instead of rotating the host fingerprint.",
            },
            {
                "key": "restore-deploy-key",
                "title": "Restore the deploy public key",
                "detail": (
                    f"Repair {incident_label}: install the matching public key in authorized_keys "
                    "or rotate DEPLOY_SSH_PRIVATE_KEY."
                ),
            },
            {
                "key": "rerun-release-audit",
                "title": "Rerun Release Secrets Audit manually",
                "detail": "Keep scheduled audit and staging pauses enabled until the manual audit succeeds.",
            },
            {
                "key": "close-and-unpause",
                "title": "Close incidents and remove pauses after green audit",
                "detail": "Close the GitHub issues and unset pause variables only after the audit is green.",
            },
        ]
        if host_blockers:
            steps.insert(1, public_target_repair_step(host_blockers))
        return steps

    if incidents:
        first_hint = next((item["operator_hint"] for item in incidents if item["operator_hint"]), "")
        steps = [
            {
                "key": "read-incident-diagnostics",
                "title": "Read the latest incident diagnostics",
                "detail": f"Start with {incident_label}; the current failure category is in the issue body.",
            },
            {
                "key": "apply-operator-hint",
                "title": "Apply the operator hint",
                "detail": first_hint or "Use the failure category and workflow logs to repair the environment.",
            },
            {
                "key": "rerun-release-audit",
                "title": "Rerun Release Secrets Audit manually",
                "detail": "Do not remove pauses until a manual audit run succeeds.",
            },
        ]
        if host_blockers:
            steps.insert(1, public_target_repair_step(host_blockers))
        return steps

    primary_blocker = str(maintenance.get("blocker_1", "") or "")
    if host_blockers:
        return [public_target_repair_step(host_blockers)]
    if primary_blocker:
        return [
            {
                "key": "resolve-primary-blocker",
                "title": "Resolve the primary release blocker",
                "detail": f"Clear this blocker before unpausing release automation: {primary_blocker}.",
            }
        ]

    return [
        {
            "key": "rerun-maintenance-check",
            "title": "Rerun maintenance status",
            "detail": "Refresh release maintenance status before unpausing.",
        }
    ]


def truthy(value: Any) -> bool:
    return str(value or "").lower() in {"1", "true", "yes", "on"}


def checklist_by_key(maintenance: dict[str, Any]) -> dict[str, dict[str, str]]:
    return {item["key"]: item for item in maintenance.get("checklist", [])}


def workflow_step_status(item: dict[str, str] | None) -> str:
    if item is None:
        return "pending"
    if item.get("status") == "ok":
        return "complete"
    if item.get("status") == "blocked":
        return "blocked"
    if item.get("status") == "warn":
        return "current"
    return "pending"


def build_repair_workflow_steps(
    maintenance: dict[str, Any],
    *,
    phase: str,
    manual_audit_command: str,
) -> list[dict[str, str]]:
    checklist = checklist_by_key(maintenance)
    host_trust_item = checklist.get(
        "ssh-trust-anchor",
        {
            "detail": "SSH trust anchor state is not present in the checklist.",
            "status": "unknown",
        },
    )
    deploy_key_item = checklist.get(
        "deploy-key",
        {
            "detail": "Deploy key state is not present in the checklist.",
            "status": "unknown",
        },
    )
    deploy_key_status = workflow_step_status(deploy_key_item)
    if deploy_key_item.get("status") == "blocked":
        deploy_key_status = "current"
    public_network_item = checklist.get(
        "public-network-check",
        {
            "detail": "Public network check state is not present in the checklist.",
            "status": "unknown",
        },
    )
    public_network_status = workflow_step_status(public_network_item)
    if public_network_item.get("status") == "blocked":
        public_network_status = "current"

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
        {
            "key": "status-json",
            "title": "Release status is connected",
            "status": "complete" if truthy(maintenance.get("available", "1")) else "current",
            "detail": "Release maintenance status is available in the public evidence bundle.",
            "operator_action": "Keep this status snapshot attached to the release incident.",
        },
        {
            "key": "pause-guard",
            "title": "Release pauses stay active",
            "status": (
                "complete"
                if truthy(maintenance.get("release_audit_scheduled_paused"))
                or truthy(maintenance.get("staging_release_paused"))
                else "pending"
            ),
            "detail": "Release automation stays paused while repair evidence is collected.",
            "operator_action": "Do not remove release pauses until a manual audit succeeds.",
        },
        {
            "key": "ssh-trust-anchor",
            "title": "SSH trust anchor is verified",
            "status": workflow_step_status(host_trust_item),
            "detail": host_trust_item.get("detail", ""),
            "operator_action": "Do not rotate known_hosts unless the failure category changes.",
        },
        {
            "key": "public-target-network",
            "title": "Public DNS and HTTPS target is reachable",
            "status": public_network_status,
            "detail": public_network_item.get("detail", ""),
            "operator_action": (
                "Restore DNS/HTTPS for the public target, then rerun Public Evidence Bundle with check_network=true."
                if public_network_status in {"current", "blocked"}
                else "Keep the public target probes attached to release evidence."
            ),
        },
        {
            "key": "restore-deploy-key",
            "title": "Deploy key can authenticate",
            "status": deploy_key_status,
            "detail": deploy_key_item.get("detail", ""),
            "operator_action": (
                "Install the matching public key in authorized_keys or rotate DEPLOY_SSH_PRIVATE_KEY."
                if deploy_key_status in {"current", "blocked"}
                else "Keep the current deploy key contract unchanged."
            ),
        },
        {
            "key": "manual-audit-rerun",
            "title": "Manual Release Secrets Audit is green",
            "status": manual_audit_status,
            "detail": "Release Secrets Audit must prove SSH auth before pauses can be removed.",
            "operator_action": manual_audit_command,
        },
        {
            "key": "close-and-unpause",
            "title": "Incidents are closed and pauses are removed",
            "status": close_status,
            "detail": "Close GitHub incident issues and remove pause variables only after green evidence.",
            "operator_action": "Schedule a watched release window, close incidents, then remove release pauses.",
        },
    ]


def build_repair_workflow_handoff(workflow: dict[str, Any]) -> str:
    lines = [
        "# Release Repair Handoff",
        "",
        f"- Phase: {workflow['phase']}",
        f"- Status: {workflow['status']}",
        f"- Summary: {workflow['summary']}",
        f"- Next action: {workflow['next_action']}",
        f"- Manual audit: `{workflow['manual_audit_command']}`",
        f"- Confirmation phrase: `{workflow['typed_confirmation_phrase']}`",
        "",
        "## Operator Steps",
    ]
    lines.extend(
        f"{index}. [{step['status']}] {step['title']}: {step['operator_action']}"
        for index, step in enumerate(workflow["steps"], start=1)
    )
    return "\n".join(lines)


def build_repair_workflow(maintenance: dict[str, Any], *, repo: str, branch: str) -> dict[str, Any]:
    checklist = checklist_by_key(maintenance)
    deploy_key_item = checklist.get("deploy-key")
    public_network_item = checklist.get("public-network-check")
    blocked_items = [item for item in maintenance.get("checklist", []) if item.get("status") == "blocked"]
    incidents = open_release_incidents(maintenance)
    manual_audit_command = release_secrets_audit_command(repo, branch)
    public_network_blocked = bool(public_network_item and public_network_item.get("status") == "blocked")
    deploy_key_blocked = bool(deploy_key_item and deploy_key_item.get("status") == "blocked")

    if not truthy(maintenance.get("available", "1")):
        phase = "status_unwired"
        status = "review"
        summary = "Release maintenance status is not connected."
        next_action = "Regenerate the maintenance JSON before using release unpause decisions."
        typed_confirmation_phrase = "confirm release status sync"
    elif truthy(maintenance.get("ready_for_unpause")):
        phase = "ready_for_unpause"
        status = "ready"
        summary = "Release maintenance is ready for a planned unpause window."
        next_action = "Schedule a watched release window before removing audit and staging pauses."
        typed_confirmation_phrase = "confirm planned release unpause"
    elif public_network_blocked and deploy_key_blocked:
        phase = "repair_required"
        status = "blocked"
        summary = "Release automation is blocked by public target probes and deploy-key authentication."
        next_action = (
            "Restore public DNS/HTTPS target, repair deploy key, then rerun Release Secrets Audit "
            "and Public Evidence network check."
        )
        typed_confirmation_phrase = "confirm public target and deploy key repair before audit"
    elif public_network_blocked:
        phase = "repair_required"
        status = "blocked"
        summary = "Live target is blocked by public DNS/HTTPS probes."
        next_action = (
            "Restore DNS/HTTPS for the public target, then rerun Public Evidence Bundle with check_network=true."
        )
        typed_confirmation_phrase = "confirm public target repair before review"
    elif deploy_key_blocked:
        phase = "repair_required"
        status = "blocked"
        summary = "Release automation is blocked because the deploy host rejects the GitHub deploy key."
        next_action = (
            "Restore the deploy public key in authorized_keys or rotate DEPLOY_SSH_PRIVATE_KEY, "
            "then rerun Release Secrets Audit manually."
        )
        typed_confirmation_phrase = "confirm deploy key repair before audit"
    elif blocked_items or incidents:
        phase = "repair_required"
        status = "blocked"
        summary = "Release automation still has open blockers before unpause."
        next_action = str(maintenance.get("blocker_1") or "Resolve release blockers before unpause.")
        typed_confirmation_phrase = "confirm release blocker repair"
    else:
        phase = "ready_for_manual_audit"
        status = "review"
        summary = "No blocking checklist item remains; manual audit evidence is needed next."
        next_action = f"Run `{manual_audit_command}` and attach the result to the release incidents."
        typed_confirmation_phrase = "confirm manual release audit"

    workflow = {
        "phase": phase,
        "status": status,
        "summary": summary,
        "next_action": next_action,
        "typed_confirmation_phrase": typed_confirmation_phrase,
        "manual_audit_command": manual_audit_command,
        "audit_trail": [
            f"source=public_evidence_bundle",
            f"phase={phase}",
            f"status={status}",
            f"ready_for_unpause={maintenance.get('ready_for_unpause', 'unknown')}",
            f"blocker_count={maintenance.get('blocker_count', '0')}",
            (
                f"production_issue=#18 state={maintenance.get('issue_18_state', 'unknown')} "
                f"category={maintenance.get('issue_18_failure_category', 'unknown')}"
            ),
            (
                f"staging_issue=#19 state={maintenance.get('issue_19_state', 'unknown')} "
                f"category={maintenance.get('issue_19_failure_category', 'unknown')}"
            ),
        ],
        "steps": build_repair_workflow_steps(
            maintenance,
            phase=phase,
            manual_audit_command=manual_audit_command,
        ),
    }
    workflow["handoff_markdown"] = build_repair_workflow_handoff(workflow)
    return workflow


def current_public_evidence_run(bundle: dict[str, Any]) -> dict[str, Any]:
    run_id = os.getenv("GITHUB_RUN_ID", "").strip()
    if not run_id:
        return bundle["workflows"].get("public_evidence", {})
    return {
        "workflowName": "Public Evidence Bundle",
        "status": "completed",
        "conclusion": "success",
        "databaseId": run_id,
        "url": f"https://github.com/{bundle['repo']}/actions/runs/{run_id}",
        "headSha": bundle["commit"],
        "displayTitle": "Public Evidence Bundle",
        "event": os.getenv("GITHUB_EVENT_NAME", ""),
        "createdAt": bundle["generated_at"],
    }


def workflow_entrypoint(
    key: str,
    label: str,
    run: dict[str, Any],
    *,
    detail: str,
) -> dict[str, str]:
    return {
        "key": key,
        "label": label,
        "type": "github_actions",
        "status": str(run.get("status", "unavailable") or "unavailable"),
        "conclusion": str(run.get("conclusion", "unavailable") or "unavailable"),
        "url": str(run.get("url", "") or ""),
        "detail": detail,
    }


def issue_entrypoint(repo: str, incident: dict[str, str]) -> dict[str, str]:
    issue_number = incident["issue_number"]
    return {
        "key": f"{incident['environment']}-incident",
        "label": f"{incident['environment'].title()} incident #{issue_number}",
        "type": "github_issue",
        "status": incident.get("state", "unknown"),
        "conclusion": incident.get("failure_category", "unknown"),
        "url": f"https://github.com/{repo}/issues/{issue_number}",
        "detail": incident.get("operator_hint") or "Open the incident and read the latest repair evidence.",
    }


def dedupe_values(values: list[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def build_review_index(bundle: dict[str, Any]) -> dict[str, Any]:
    maintenance = bundle["maintenance"]
    repair_workflow = maintenance.get("repair_workflow", {})
    workflows = bundle["workflows"]
    incidents = release_incidents(maintenance)
    open_incidents = [incident for incident in incidents if incident["state"] != "CLOSED"]
    primary_blockers = release_blockers(maintenance)
    primary_blockers.extend(
        f"issue #{incident['issue_number']} {incident['environment']} category={incident['failure_category']}"
        for incident in open_incidents
    )

    live_target_status = "blocked" if maintenance.get("network_blockers") else "ok"
    if str(maintenance.get("network_checks", "unknown")) == "skipped":
        live_target_status = "skipped"

    entrypoints = [
        workflow_entrypoint(
            "ci",
            "CI run",
            workflows["ci"],
            detail="Code, tests, and release contract checks for the current branch.",
        ),
        workflow_entrypoint(
            "public-evidence",
            "Public evidence bundle",
            current_public_evidence_run(bundle),
            detail="Single artifact set containing release status, repair workflow, and review data.",
        ),
        workflow_entrypoint(
            "release-maintenance-status",
            "Release maintenance status",
            workflows["release_maintenance_status"],
            detail="Scheduled/manual status snapshot for release pauses, incidents, and target checks.",
        ),
        workflow_entrypoint(
            "release-secrets-audit",
            "Release secrets audit",
            workflows["release_secrets_audit"],
            detail="Manual audit that must pass before release pauses can be removed.",
        ),
        workflow_entrypoint(
            "deploy-key-recovery",
            "Deploy key recovery packet",
            workflows["deploy_key_recovery"],
            detail=(
                "Manual packet that derives the deploy public key and fingerprint "
                "from the GitHub environment secret without exposing the private key."
            ),
        ),
    ]
    entrypoints.extend(issue_entrypoint(bundle["repo"], incident) for incident in incidents)
    entrypoints.extend(
        [
            {
                "key": "review-console",
                "label": "Review console",
                "type": "frontend_route",
                "status": live_target_status,
                "conclusion": str(maintenance.get("network_checks", "unknown")),
                "url": FALLBACK_REVIEW_URL,
                "detail": (
                    "Fallback public route that ties product route map, CI evidence, "
                    "local packet command, and artifact entrypoints together while "
                    "the primary release target is under repair."
                ),
            },
            {
                "key": "fallback-live-target",
                "label": "Fallback live target",
                "type": "public_probe",
                "status": "published",
                "conclusion": "fallback",
                "url": FALLBACK_LIVE_URL,
                "detail": (
                    "German VPS fallback target used for review while the primary "
                    "custom domain release target is repaired."
                ),
            },
            {
                "key": "release-repair-workflow",
                "label": "Release repair workflow",
                "type": "evidence_section",
                "status": str(repair_workflow.get("status", "unknown")),
                "conclusion": str(repair_workflow.get("phase", "unknown")),
                "url": "",
                "detail": str(repair_workflow.get("next_action", "")),
            },
            {
                "key": "live-target",
                "label": "Live target",
                "type": "public_probe",
                "status": live_target_status,
                "conclusion": str(maintenance.get("network_checks", "unknown")),
                "url": PRIMARY_LIVE_URL,
                "detail": (
                    "; ".join(maintenance.get("network_blockers") or [])
                    or "Public DNS and HTTPS probes are not blocking this snapshot."
                ),
            },
        ]
    )

    return {
        "status": str(repair_workflow.get("status", "unknown")),
        "phase": str(repair_workflow.get("phase", "unknown")),
        "summary": str(repair_workflow.get("summary", "")),
        "next_action": str(repair_workflow.get("next_action", "")),
        "primary_blockers": dedupe_values(primary_blockers),
        "entrypoints": entrypoints,
        "reviewer_sequence": [
            {
                "key": "ci",
                "title": "Confirm CI",
                "detail": "Open the CI run and verify it completed successfully for the reviewed commit.",
            },
            {
                "key": "public-evidence",
                "title": "Open public evidence",
                "detail": "Read deploymate-public-evidence.md and this review index before checking the live target.",
            },
            {
                "key": "review-console",
                "title": "Open review console",
                "detail": f"Open {FALLBACK_REVIEW_URL}; if the primary live target is paused, keep this artifact as the review source.",
            },
            {
                "key": "incidents",
                "title": "Check release incidents",
                "detail": "Open issues #18 and #19 and compare their marker comments with this bundle.",
            },
            {
                "key": "repair-workflow",
                "title": "Follow the repair workflow",
                "detail": "Use the current step in Release Repair Workflow Packet as the operator handoff.",
            },
            {
                "key": "deploy-key-recovery",
                "title": "Generate deploy key recovery packet",
                "detail": (
                    "Run Deploy Key Recovery Packet for the blocked environment "
                    "to get the exact public key line needed for authorized_keys."
                ),
            },
            {
                "key": "live-target",
                "title": "Verify live target last",
                "detail": "Treat the live demo as available only after public DNS/HTTPS probes are green.",
            },
        ],
        "manual_commands": {
            "release_secrets_audit": str(repair_workflow.get("manual_audit_command", "")),
            "deploy_key_recovery_production": (
                f"gh workflow run {DEPLOY_KEY_RECOVERY_WORKFLOW} --repo {bundle['repo']} "
                f"--ref {bundle['branch']} -f target_environment=production"
            ),
            "deploy_key_recovery_staging": (
                f"gh workflow run {DEPLOY_KEY_RECOVERY_WORKFLOW} --repo {bundle['repo']} "
                f"--ref {bundle['branch']} -f target_environment=staging"
            ),
            "public_evidence_network_publish": (
                f"gh workflow run public-evidence-bundle.yml --repo {bundle['repo']} "
                f"--ref {bundle['branch']} -f check_network=true -f publish_incident_comment=true"
            ),
        },
    }


def build_issue_comment(bundle: dict[str, Any]) -> str:
    maintenance = bundle["maintenance"]
    repair_workflow = maintenance.get("repair_workflow", {})
    review_index = bundle.get("review_index", {})
    workflows = bundle["workflows"]
    incidents = release_incidents(maintenance)
    steps = repair_workflow.get("steps", [])

    lines = [
        ISSUE_COMMENT_MARKER,
        "## DeployMate Release Repair Evidence",
        "",
        f"- Generated: `{bundle['generated_at']}`",
        f"- Repository: `{bundle['repo']}`",
        f"- Branch: `{bundle['branch']}`",
        f"- Commit: `{bundle['commit']}`",
        f"- Phase: `{repair_workflow.get('phase', 'unknown')}`",
        f"- Status: `{repair_workflow.get('status', 'unknown')}`",
        f"- Next action: {repair_workflow.get('next_action', '')}",
        f"- Manual audit: `{repair_workflow.get('manual_audit_command', '')}`",
        f"- Confirmation phrase: `{repair_workflow.get('typed_confirmation_phrase', '')}`",
        "",
        "### Review index",
        "",
        f"- Status: `{review_index.get('status', 'unknown')}`",
        f"- Summary: {review_index.get('summary', '')}",
        f"- Primary blockers: {', '.join(review_index.get('primary_blockers', [])) or '`none`'}",
        "",
        "### Current incidents",
        "",
        "| Issue | Environment | State | Failure category |",
        "| --- | --- | --- | --- |",
    ]
    for incident in incidents:
        lines.append(
            f"| #{incident['issue_number']} | `{incident['environment']}` | "
            f"`{incident['state']}` | `{incident['failure_category']}` |"
        )

    lines.extend(
        [
            "",
            "### Workflow evidence",
            "",
            "| Workflow | Status | Conclusion | Run |",
            "| --- | --- | --- | --- |",
            workflow_row("CI", workflows["ci"]),
            workflow_row("Release Maintenance Status", workflows["release_maintenance_status"]),
            workflow_row("Release Secrets Audit", workflows["release_secrets_audit"]),
            workflow_row("Deploy Key Recovery Packet", workflows["deploy_key_recovery"]),
            workflow_row("Public Evidence Bundle", current_public_evidence_run(bundle)),
            "",
            "### Operator steps",
            "",
        ]
    )
    for index, step in enumerate(steps, start=1):
        lines.append(
            f"{index}. **{step.get('title', step.get('key', 'unknown'))}** "
            f"(`{step.get('status', 'unknown')}`): {step.get('operator_action', '')}"
        )

    lines.extend(
        [
            "",
            "This comment is generated from the public evidence bundle. Re-running the publisher updates this same comment instead of adding duplicates.",
            "",
        ]
    )
    return "\n".join(lines)


def open_incident_issue_numbers(bundle: dict[str, Any]) -> list[int]:
    numbers: list[int] = []
    for incident in release_incidents(bundle["maintenance"]):
        if incident["state"] != "CLOSED":
            try:
                numbers.append(int(incident["issue_number"]))
            except ValueError:
                continue
    return numbers


def publish_issue_comment(bundle: dict[str, Any], *, issue_number: int) -> dict[str, Any]:
    comment_body = build_issue_comment(bundle)
    comments = gh_api_json(
        repo=bundle["repo"],
        endpoint=f"issues/{issue_number}/comments?per_page=100",
    )
    existing = next(
        (
            comment
            for comment in comments
            if ISSUE_COMMENT_MARKER in str(comment.get("body", ""))
        ),
        None,
    )
    if existing:
        updated = gh_api_json(
            repo=bundle["repo"],
            endpoint=f"issues/comments/{existing['id']}",
            method="PATCH",
            payload={"body": comment_body},
        )
        return {
            "issue_number": issue_number,
            "action": "updated",
            "comment_id": updated.get("id", existing["id"]),
            "url": updated.get("html_url", existing.get("html_url", "")),
        }

    created = gh_api_json(
        repo=bundle["repo"],
        endpoint=f"issues/{issue_number}/comments",
        method="POST",
        payload={"body": comment_body},
    )
    return {
        "issue_number": issue_number,
        "action": "created",
        "comment_id": created.get("id", ""),
        "url": created.get("html_url", ""),
    }


def publish_open_incident_comments(bundle: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        publish_issue_comment(bundle, issue_number=issue_number)
        for issue_number in open_incident_issue_numbers(bundle)
    ]


def md_escape(value: Any) -> str:
    text = str(value if value is not None else "")
    return text.replace("|", "\\|")


def workflow_row(label: str, run: dict[str, Any]) -> str:
    url = run.get("url") or ""
    run_id = run.get("databaseId") or "unavailable"
    run_link = f"[{run_id}]({url})" if url else f"`{run_id}`"
    return (
        f"| {md_escape(label)} | `{md_escape(run.get('status', ''))}` | "
        f"`{md_escape(run.get('conclusion', ''))}` | {run_link} |"
    )


def entrypoint_row(entrypoint: dict[str, Any]) -> str:
    url = entrypoint.get("url") or ""
    label = md_escape(entrypoint.get("label", entrypoint.get("key", "unknown")))
    label_text = f"[{label}]({url})" if url else label
    return (
        f"| {label_text} | `{md_escape(entrypoint.get('type', 'unknown'))}` | "
        f"`{md_escape(entrypoint.get('status', 'unknown'))}` | "
        f"`{md_escape(entrypoint.get('conclusion', 'unknown'))}` | "
        f"{md_escape(entrypoint.get('detail', ''))} |"
    )


def render_markdown(bundle: dict[str, Any]) -> str:
    maintenance = bundle["maintenance"]
    workflows = bundle["workflows"]
    review_index = bundle.get("review_index", {})
    blocker_count = int(maintenance.get("blocker_count", "0") or "0")
    blockers = [maintenance.get(f"blocker_{index}", "") for index in range(1, blocker_count + 1)]
    blockers = [item for item in blockers if item]

    lines = [
        "# DeployMate Public Evidence Bundle",
        "",
        "| Field | Value |",
        "| --- | --- |",
        f"| Generated at | `{md_escape(bundle['generated_at'])}` |",
        f"| Repository | `{md_escape(bundle['repo'])}` |",
        f"| Branch | `{md_escape(bundle['branch'])}` |",
        f"| Commit | `{md_escape(bundle['commit'])}` |",
        f"| Ready for unpause | `{md_escape(maintenance.get('ready_for_unpause', 'unknown'))}` |",
        "",
        "## Review Index",
        "",
        f"- Status: `{md_escape(review_index.get('status', 'unknown'))}`",
        f"- Phase: `{md_escape(review_index.get('phase', 'unknown'))}`",
        f"- Summary: {md_escape(review_index.get('summary', ''))}",
        f"- Next action: {md_escape(review_index.get('next_action', ''))}",
        "",
        "### Primary Blockers",
        "",
    ]
    primary_blockers = review_index.get("primary_blockers", [])
    if primary_blockers:
        lines.extend(f"- {md_escape(blocker)}" for blocker in primary_blockers)
    else:
        lines.append("- None.")

    lines.extend(
        [
            "",
            "### Entrypoints",
            "",
            "| Entrypoint | Type | Status | Conclusion | Detail |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    lines.extend(entrypoint_row(entrypoint) for entrypoint in review_index.get("entrypoints", []))

    lines.extend(
        [
            "",
            "### Reviewer Sequence",
            "",
        ]
    )
    for index, step in enumerate(review_index.get("reviewer_sequence", []), start=1):
        lines.append(
            f"{index}. **{md_escape(step.get('title', step.get('key', 'unknown')))}**: "
            f"{md_escape(step.get('detail', ''))}"
        )

    lines.extend(
        [
            "",
            "## Workflow Evidence",
            "",
            "| Workflow | Status | Conclusion | Run |",
            "| --- | --- | --- | --- |",
            workflow_row("CI", workflows["ci"]),
            workflow_row("Release Maintenance Status", workflows["release_maintenance_status"]),
            workflow_row("Release Secrets Audit", workflows["release_secrets_audit"]),
            workflow_row("Deploy Key Recovery Packet", workflows["deploy_key_recovery"]),
            workflow_row("Public Evidence Bundle", current_public_evidence_run(bundle)),
            workflow_row("Staging", workflows["staging"]),
            "",
            "## Maintenance Evidence",
            "",
            (
                "- Release audit schedule paused: "
                f"`{maintenance.get('release_audit_scheduled_paused', 'unknown')}`"
            ),
            f"- Staging release paused: `{maintenance.get('staging_release_paused', 'unknown')}`",
            f"- Issue #18: `{maintenance.get('issue_18_state', 'unknown')}`",
            f"- Issue #19: `{maintenance.get('issue_19_state', 'unknown')}`",
            f"- Network checks: `{maintenance.get('network_checks', 'enabled')}`",
            "",
            "## Incident Diagnostics",
            "",
            "| Issue | State | Failure category | Operator hint |",
            "| --- | --- | --- | --- |",
            (
                f"| #18 | `{md_escape(maintenance.get('issue_18_state', 'unknown'))}` | "
                f"`{md_escape(maintenance.get('issue_18_failure_category', 'unknown'))}` | "
                f"{md_escape(maintenance.get('issue_18_operator_hint', '')) or '`unavailable`'} |"
            ),
            (
                f"| #19 | `{md_escape(maintenance.get('issue_19_state', 'unknown'))}` | "
                f"`{md_escape(maintenance.get('issue_19_failure_category', 'unknown'))}` | "
                f"{md_escape(maintenance.get('issue_19_operator_hint', '')) or '`unavailable`'} |"
            ),
            "",
            "## Current Blockers",
            "",
        ]
    )

    if blockers:
        lines.extend(f"- {blocker}" for blocker in blockers)
    else:
        lines.append("- None.")

    checklist = maintenance.get("checklist", [])
    if checklist:
        lines.extend(
            [
                "",
                "## Release Readiness Checklist",
                "",
                "| Check | Status | Detail |",
                "| --- | --- | --- |",
            ]
        )
        for item in checklist:
            lines.append(
                f"| {md_escape(item.get('label', item.get('key', 'unknown')))} | "
                f"`{md_escape(item.get('status', 'unknown'))}` | "
                f"{md_escape(item.get('detail', ''))} |"
            )

    repair_steps = build_repair_playbook(maintenance)
    lines.extend(
        [
            "",
            "## Release Repair Playbook",
            "",
        ]
    )
    for index, step in enumerate(repair_steps, start=1):
        lines.append(
            f"{index}. **{md_escape(step['title'])}**: {md_escape(step['detail'])}"
        )

    repair_workflow = maintenance.get("repair_workflow", {})
    repair_workflow_steps = repair_workflow.get("steps", [])
    if repair_workflow:
        lines.extend(
            [
                "",
                "## Release Repair Workflow Packet",
                "",
                f"- Phase: `{md_escape(repair_workflow.get('phase', 'unknown'))}`",
                f"- Status: `{md_escape(repair_workflow.get('status', 'unknown'))}`",
                f"- Summary: {md_escape(repair_workflow.get('summary', ''))}",
                f"- Next action: {md_escape(repair_workflow.get('next_action', ''))}",
                f"- Manual audit: `{md_escape(repair_workflow.get('manual_audit_command', ''))}`",
                (
                    f"- Confirmation phrase: "
                    f"`{md_escape(repair_workflow.get('typed_confirmation_phrase', ''))}`"
                ),
                "",
                "| Step | State | Operator action |",
                "| --- | --- | --- |",
            ]
        )
        for step in repair_workflow_steps:
            lines.append(
                f"| {md_escape(step.get('title', step.get('key', 'unknown')))} | "
                f"`{md_escape(step.get('status', 'unknown'))}` | "
                f"{md_escape(step.get('operator_action', ''))} |"
            )

    lines.extend(
        [
            "",
            "## Reviewer Path",
            "",
        ]
    )
    lines.extend(f"- `{item}`" for item in bundle["reviewer_path"])
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a public DeployMate evidence bundle.")
    parser.add_argument("--repo", default=os.getenv("GITHUB_REPOSITORY", "AlexGerlitz/deploymate"))
    parser.add_argument("--branch", default=os.getenv("GITHUB_REF_NAME", "develop"))
    parser.add_argument(
        "--format",
        choices=("json", "markdown", "issue-comment", "review-index"),
        default="markdown",
    )
    parser.add_argument("--check-network", action="store_true")
    parser.add_argument(
        "--publish-open-incident-comments",
        action="store_true",
        help="Create or update the marker comment on currently open release incident issues.",
    )
    args = parser.parse_args()

    bundle = build_bundle(args.repo, args.branch, args.check_network)
    if args.publish_open_incident_comments:
        bundle["published_issue_comments"] = publish_open_incident_comments(bundle)

    if args.format == "json":
        json.dump(bundle, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    if args.format == "issue-comment":
        sys.stdout.write(build_issue_comment(bundle))
        return 0

    if args.format == "review-index":
        json.dump(bundle["review_index"], sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    sys.stdout.write(render_markdown(bundle))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
