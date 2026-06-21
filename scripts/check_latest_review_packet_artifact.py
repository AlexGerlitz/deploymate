#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
VERIFY_SCRIPT = ROOT_DIR / "scripts" / "verify_review_packet.py"
DEFAULT_WORKFLOW = "public-evidence-bundle.yml"
DEFAULT_ARTIFACT = "deploymate-review-packet"


def run_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=False,
    )


def require_gh() -> None:
    if shutil.which("gh") is None:
        raise RuntimeError("gh CLI is required to download the review packet artifact")


def load_workflow_runs(repo: str, branch: str, workflow: str, limit: int) -> list[dict[str, Any]]:
    result = run_command(
        [
            "gh",
            "run",
            "list",
            "--repo",
            repo,
            "--workflow",
            workflow,
            "--branch",
            branch,
            "--limit",
            str(limit),
            "--json",
            "databaseId,status,conclusion,headSha,createdAt,url,workflowName",
        ]
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "gh run list failed").strip())

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"gh run list returned invalid JSON: {exc}") from exc

    if not isinstance(payload, list):
        raise RuntimeError("gh run list returned a non-list payload")
    return payload


def select_latest_successful_run(runs: list[dict[str, Any]]) -> dict[str, Any]:
    for run in runs:
        if run.get("status") == "completed" and run.get("conclusion") == "success":
            return run
    raise RuntimeError("no successful completed Public Evidence Bundle run found")


def prepare_output_dir(output_dir: str | None) -> Path:
    if not output_dir:
        return Path(tempfile.mkdtemp(prefix="deploymate-review-packet-"))

    path = Path(output_dir).resolve()
    if path.exists() and any(path.iterdir()):
        raise RuntimeError(f"output directory is not empty: {path}")
    path.mkdir(parents=True, exist_ok=True)
    return path


def download_artifact(repo: str, run_id: int | str, artifact: str, output_dir: Path) -> None:
    result = run_command(
        [
            "gh",
            "run",
            "download",
            str(run_id),
            "--repo",
            repo,
            "--name",
            artifact,
            "--dir",
            str(output_dir),
        ]
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "gh run download failed").strip())


def verify_packet(packet_dir: Path) -> None:
    result = run_command([sys.executable, str(VERIFY_SCRIPT.relative_to(ROOT_DIR)), str(packet_dir)])
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "review packet verification failed").strip())


def load_packet_bundle(packet_dir: Path) -> dict[str, Any]:
    bundle_path = packet_dir / "deploymate-public-evidence.json"
    if not bundle_path.exists():
        raise RuntimeError(f"downloaded review packet is missing {bundle_path.name}")
    try:
        return json.loads(bundle_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{bundle_path.name} is invalid JSON: {exc}") from exc


def assert_packet_matches_run(bundle: dict[str, Any], run: dict[str, Any]) -> None:
    workflows = bundle.get("workflows")
    if not isinstance(workflows, dict):
        raise RuntimeError("deploymate-public-evidence.json missing workflows object")

    public_evidence = workflows.get("public_evidence")
    if not isinstance(public_evidence, dict):
        raise RuntimeError("deploymate-public-evidence.json missing workflows.public_evidence")

    run_id = str(run.get("databaseId", ""))
    packet_run_id = str(public_evidence.get("databaseId", ""))
    if packet_run_id != run_id:
        raise RuntimeError(
            f"review packet run mismatch: manifest bundle has {packet_run_id}, latest run is {run_id}"
        )

    run_sha = str(run.get("headSha", "") or "")
    packet_sha = str(bundle.get("commit", "") or "")
    if run_sha and packet_sha and run_sha != packet_sha:
        raise RuntimeError(
            f"review packet commit mismatch: bundle has {packet_sha}, latest run has {run_sha}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download and verify the latest DeployMate review packet artifact."
    )
    parser.add_argument("--repo", default=os.getenv("GITHUB_REPOSITORY", "AlexGerlitz/deploymate"))
    parser.add_argument("--branch", default=os.getenv("GITHUB_REF_NAME", "develop"))
    parser.add_argument("--workflow", default=DEFAULT_WORKFLOW)
    parser.add_argument("--artifact", default=DEFAULT_ARTIFACT)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument(
        "--output-dir",
        default="",
        help="Empty directory for the downloaded packet. Defaults to a fresh temporary directory.",
    )
    args = parser.parse_args()

    try:
        require_gh()
        runs = load_workflow_runs(args.repo, args.branch, args.workflow, args.limit)
        run = select_latest_successful_run(runs)
        output_dir = prepare_output_dir(args.output_dir)
        download_artifact(args.repo, run["databaseId"], args.artifact, output_dir)
        verify_packet(output_dir)
        bundle = load_packet_bundle(output_dir)
        assert_packet_matches_run(bundle, run)
    except RuntimeError as exc:
        print(f"[review-packet-artifact] {exc}", file=sys.stderr)
        return 1

    print(f"[review-packet-artifact] ok {output_dir}")
    print(f"[review-packet-artifact] run {run['databaseId']} {run.get('url', '')}")
    print(f"[review-packet-artifact] commit {bundle.get('commit', '')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
