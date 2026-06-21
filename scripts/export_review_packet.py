#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
EVIDENCE_SCRIPT = ROOT_DIR / "scripts" / "public_evidence_bundle.py"
FALLBACK_REVIEW_URL = "https://deploymate.152.53.178.83.sslip.io/review"
PACKET_FILES = {
    "json": "deploymate-public-evidence.json",
    "review-index": "deploymate-review-index.json",
    "markdown": "deploymate-public-evidence.md",
    "issue-comment": "deploymate-release-repair-issue-comment.md",
}
PACKET_README = "README.md"
PACKET_STATUS = "PROJECT_STATUS.md"


def run_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT_DIR,
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


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(f"{path.suffix}.tmp")
    tmp_path.write_text(text, encoding="utf-8")
    tmp_path.replace(path)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def packet_file_entry(output_dir: Path, filename: str) -> dict[str, Any]:
    path = output_dir / filename
    return {
        "path": filename,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def evidence_command(repo: str, branch: str, output_format: str, check_network: bool) -> list[str]:
    command = [
        sys.executable,
        str(EVIDENCE_SCRIPT.relative_to(ROOT_DIR)),
        "--repo",
        repo,
        "--branch",
        branch,
        "--format",
        output_format,
    ]
    if check_network:
        command.append("--check-network")
    return command


def command_for_manifest(command: list[str]) -> str:
    display = ["python3" if item == sys.executable else item for item in command]
    return " ".join(display)


def text_value(value: Any, default: str = "unavailable") -> str:
    if isinstance(value, str) and value:
        return value
    if value is None:
        return default
    return str(value)


def dict_value(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def list_value(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def workflow_status_line(workflows: dict[str, Any], key: str, label: str) -> str:
    workflow = dict_value(workflows.get(key))
    status = text_value(workflow.get("status"))
    conclusion = text_value(workflow.get("conclusion"))
    url = text_value(workflow.get("url"), "")
    run = text_value(workflow.get("databaseId"), "")
    if url:
        return f"- {label}: `{status}` / `{conclusion}` ([run {run}]({url}))"
    return f"- {label}: `{status}` / `{conclusion}`"


def build_project_status_markdown(
    *,
    evidence: dict[str, Any],
    repo: str,
    branch: str,
    commit: str,
    generated_at: str,
    check_network: bool,
) -> str:
    review_index = dict_value(evidence.get("review_index"))
    workflows = dict_value(evidence.get("workflows"))
    maintenance = dict_value(evidence.get("maintenance"))
    blockers = [
        text_value(item)
        for item in list_value(review_index.get("primary_blockers"))
        if text_value(item, "")
    ]
    next_action = text_value(review_index.get("next_action"))
    project_status = text_value(review_index.get("status"))
    phase = text_value(review_index.get("phase"))
    summary = text_value(review_index.get("summary"))
    ready_for_unpause = text_value(maintenance.get("ready_for_unpause"))
    public_network = text_value(maintenance.get("network_checks"))

    lines = [
        "# DeployMate Project Status",
        "",
        "Generated from `deploymate-public-evidence.json` inside the review packet.",
        "",
        "| Field | Value |",
        "| --- | --- |",
        f"| Repository | `{repo}` |",
        f"| Branch | `{branch}` |",
        f"| Commit | `{commit}` |",
        f"| Generated at | `{generated_at}` |",
        f"| Evidence status | `{project_status}` |",
        f"| Evidence phase | `{phase}` |",
        f"| Network checks | `{'enabled' if check_network else 'skipped'}` |",
        f"| Public network status | `{public_network}` |",
        f"| Ready for unpause | `{ready_for_unpause}` |",
        "",
        "## Built Surface",
        "",
        "- self-hosted Docker deployment control panel",
        "- deployment workflow, templates, runtime queue, and runtime detail pages",
        "- operator workspace with release-maintenance status and export actions",
        "- admin users, upgrade requests, audit-oriented views, backup bundle, and restore dry-run",
        "- public evidence bundle, review packet, manifest verification, and one-command public review gate",
        "",
        "## Current Evidence",
        "",
        workflow_status_line(workflows, "ci", "CI"),
        workflow_status_line(workflows, "public_evidence", "Public Evidence Bundle"),
        workflow_status_line(workflows, "release_maintenance_status", "Release Maintenance Status"),
        workflow_status_line(workflows, "release_secrets_audit", "Release Secrets Audit"),
        workflow_status_line(workflows, "deploy_key_recovery", "Deploy Key Recovery Packet"),
        "",
        "## Current Status",
        "",
        summary,
        "",
        "Next operator action:",
        "",
        f"- {next_action}",
        "",
        "## Current Blockers",
        "",
    ]

    if blockers:
        lines.extend(f"- {blocker}" for blocker in blockers)
    else:
        lines.append("- none reported in the review index")

    lines.extend(
        [
            "",
            "## Verification Commands",
            "",
            "- `make public-review`",
            "- `python3 scripts/export_review_packet.py --output dist/review`",
            "- `python3 scripts/verify_review_packet.py dist/review`",
            "- `python3 scripts/check_latest_review_packet_artifact.py`",
            "",
            "## Not Claimed Yet",
            "",
            "- the live target is only reviewable when the public evidence bundle reports the public network check as ok",
            "- automatic staging and production release remain paused while release incidents are open",
            "- commercial SaaS readiness still requires real tenants, billing, support process, SLA, and customer rollout evidence",
            "",
        ]
    )
    return "\n".join(lines)


def build_packet_readme(
    *,
    repo: str,
    branch: str,
    commit: str,
    generated_at: str,
    check_network: bool,
    commands: list[str],
) -> str:
    lines = [
        "# DeployMate Review Packet",
        "",
        "| Field | Value |",
        "| --- | --- |",
        f"| Repository | `{repo}` |",
        f"| Branch | `{branch}` |",
        f"| Commit | `{commit}` |",
        f"| Generated at | `{generated_at}` |",
        f"| Network checks | `{'enabled' if check_network else 'skipped'}` |",
        "",
        "## Open First",
        "",
        "1. `PROJECT_STATUS.md`",
        "2. `deploymate-public-evidence.md`",
        "3. `deploymate-review-index.json`",
        f"4. `{FALLBACK_REVIEW_URL}` for the live fallback review console",
        "5. `/review` or `https://deploymatecloud.ru/review` when the primary live frontend is available",
        "",
        "## Files",
        "",
    ]
    for filename in [PACKET_README, PACKET_STATUS, *PACKET_FILES.values(), "MANIFEST.json"]:
        lines.append(f"- `{filename}`")

    lines.extend(
        [
            "",
            "## Rebuild",
            "",
        ]
    )
    lines.extend(f"- `{command}`" for command in commands)
    lines.append("")
    return "\n".join(lines)


def export_packet(repo: str, branch: str, output_dir: Path, check_network: bool) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    commands = []
    generated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    commit = git_value("rev-parse", "HEAD")

    for output_format, filename in PACKET_FILES.items():
        command = evidence_command(repo, branch, output_format, check_network)
        result = run_command(command)
        commands.append(command_for_manifest(command))
        if result.returncode != 0:
            raise RuntimeError(
                "public evidence export failed for "
                f"{output_format}: {(result.stderr or result.stdout).strip()}"
            )
        write_text(output_dir / filename, result.stdout)

    evidence = json.loads((output_dir / PACKET_FILES["json"]).read_text(encoding="utf-8"))
    write_text(
        output_dir / PACKET_STATUS,
        build_project_status_markdown(
            evidence=evidence,
            repo=repo,
            branch=branch,
            commit=commit,
            generated_at=generated_at,
            check_network=check_network,
        ),
    )

    write_text(
        output_dir / PACKET_README,
        build_packet_readme(
            repo=repo,
            branch=branch,
            commit=commit,
            generated_at=generated_at,
            check_network=check_network,
            commands=commands,
        ),
    )

    manifest = {
        "generated_at": generated_at,
        "repo": repo,
        "branch": branch,
        "commit": commit,
        "source": "local-review-packet",
        "check_network": check_network,
        "files": [
            packet_file_entry(output_dir, filename)
            for filename in [PACKET_README, PACKET_STATUS, *PACKET_FILES.values()]
        ],
        "commands": commands,
    }
    write_text(output_dir / "MANIFEST.json", json.dumps(manifest, indent=2) + "\n")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Export a local DeployMate review packet.")
    parser.add_argument("--repo", default=os.getenv("GITHUB_REPOSITORY", "AlexGerlitz/deploymate"))
    parser.add_argument("--branch", default=os.getenv("GITHUB_REF_NAME", "develop"))
    parser.add_argument("--output", default="dist/review")
    parser.add_argument("--check-network", action="store_true")
    args = parser.parse_args()

    output_dir = (ROOT_DIR / args.output).resolve()
    try:
        manifest = export_packet(args.repo, args.branch, output_dir, args.check_network)
    except RuntimeError as exc:
        print(f"[review-packet] {exc}", file=sys.stderr)
        return 1

    print(f"[review-packet] wrote {output_dir}")
    print(f"[review-packet] manifest {output_dir / 'MANIFEST.json'}")
    print(f"[review-packet] files {len(manifest['files'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
