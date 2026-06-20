#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]


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


def build_bundle(repo: str, branch: str, check_network: bool) -> dict[str, Any]:
    runs = load_github_runs(repo, branch)
    maintenance = load_maintenance_status(repo, check_network)
    commit = os.getenv("GITHUB_SHA") or git_value("rev-parse", "HEAD")
    current_branch = branch or os.getenv("GITHUB_REF_NAME") or git_value("rev-parse", "--abbrev-ref", "HEAD")

    selected_workflows = {
        "ci": latest_workflow(runs, "CI"),
        "release_maintenance_status": latest_workflow(runs, "Release Maintenance Status"),
        "release_secrets_audit": latest_workflow(runs, "Release Secrets Audit"),
        "staging": latest_workflow(runs, "Staging"),
    }

    return {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "repo": repo,
        "branch": current_branch,
        "commit": commit,
        "maintenance": maintenance,
        "workflows": selected_workflows,
        "reviewer_path": [
            "README.md",
            "docs/releases/v0.1.0.md",
            "RUNBOOK.md",
            "SAFE-RELEASE.md",
            "Release Maintenance Status artifact",
        ],
    }


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


def render_markdown(bundle: dict[str, Any]) -> str:
    maintenance = bundle["maintenance"]
    workflows = bundle["workflows"]
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
        "## Workflow Evidence",
        "",
        "| Workflow | Status | Conclusion | Run |",
        "| --- | --- | --- | --- |",
        workflow_row("CI", workflows["ci"]),
        workflow_row("Release Maintenance Status", workflows["release_maintenance_status"]),
        workflow_row("Release Secrets Audit", workflows["release_secrets_audit"]),
        workflow_row("Staging", workflows["staging"]),
        "",
        "## Maintenance Evidence",
        "",
        f"- Release audit schedule paused: `{maintenance.get('release_audit_scheduled_paused', 'unknown')}`",
        f"- Staging release paused: `{maintenance.get('staging_release_paused', 'unknown')}`",
        f"- Issue #18: `{maintenance.get('issue_18_state', 'unknown')}`",
        f"- Issue #19: `{maintenance.get('issue_19_state', 'unknown')}`",
        f"- Network checks: `{maintenance.get('network_checks', 'enabled')}`",
        "",
        "## Current Blockers",
        "",
    ]

    if blockers:
        lines.extend(f"- {blocker}" for blocker in blockers)
    else:
        lines.append("- None.")

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
    parser.add_argument("--format", choices=("json", "markdown"), default="markdown")
    parser.add_argument("--check-network", action="store_true")
    args = parser.parse_args()

    bundle = build_bundle(args.repo, args.branch, args.check_network)
    if args.format == "json":
        json.dump(bundle, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    sys.stdout.write(render_markdown(bundle))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
