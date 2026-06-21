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
PACKET_FILES = {
    "json": "deploymate-public-evidence.json",
    "review-index": "deploymate-review-index.json",
    "markdown": "deploymate-public-evidence.md",
    "issue-comment": "deploymate-release-repair-issue-comment.md",
}


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


def export_packet(repo: str, branch: str, output_dir: Path, check_network: bool) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    commands = []

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

    manifest = {
        "generated_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "repo": repo,
        "branch": branch,
        "commit": git_value("rev-parse", "HEAD"),
        "source": "local-review-packet",
        "check_network": check_network,
        "files": [
            packet_file_entry(output_dir, filename)
            for filename in PACKET_FILES.values()
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
