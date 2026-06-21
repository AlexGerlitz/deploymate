#!/usr/bin/env python3

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def manifest_file_entry_names(manifest: dict[str, Any]) -> set[str]:
    files = manifest.get("files")
    if not isinstance(files, list):
        raise ValueError("manifest files must be a list")

    names = set()
    for index, item in enumerate(files, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"manifest files[{index}] must be an object")
        name = item.get("path")
        if not isinstance(name, str) or not name:
            raise ValueError(f"manifest files[{index}] has invalid path")
        entry_path = Path(name)
        if entry_path.is_absolute() or ".." in entry_path.parts or len(entry_path.parts) != 1:
            raise ValueError(f"manifest path {name!r} must be a local packet filename")
        if name in names:
            raise ValueError(f"manifest path {name!r} is duplicated")
        names.add(name)
    return names


def verify_packet(packet_dir: Path, *, strict: bool) -> list[str]:
    errors = []
    manifest_path = packet_dir / "MANIFEST.json"
    if not manifest_path.exists():
        return [f"missing {manifest_path}"]

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected_names = manifest_file_entry_names(manifest)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return [f"invalid MANIFEST.json: {exc}"]

    for item in manifest["files"]:
        filename = item["path"]
        path = packet_dir / filename
        if not path.exists():
            errors.append(f"{filename}: missing")
            continue
        if not path.is_file():
            errors.append(f"{filename}: not a file")
            continue

        expected_bytes = item.get("bytes")
        if not isinstance(expected_bytes, int):
            errors.append(f"{filename}: manifest bytes must be an integer")
        elif expected_bytes != path.stat().st_size:
            errors.append(
                f"{filename}: byte size mismatch manifest={expected_bytes} actual={path.stat().st_size}"
            )

        expected_sha256 = item.get("sha256")
        if not isinstance(expected_sha256, str) or len(expected_sha256) != 64:
            errors.append(f"{filename}: manifest sha256 is invalid")
        else:
            actual_sha256 = sha256_file(path)
            if expected_sha256 != actual_sha256:
                errors.append(
                    f"{filename}: sha256 mismatch manifest={expected_sha256} actual={actual_sha256}"
                )

    if strict:
        allowed_names = expected_names | {"MANIFEST.json"}
        actual_names = {path.name for path in packet_dir.iterdir() if path.is_file()}
        extras = sorted(actual_names - allowed_names)
        if extras:
            errors.append(f"unexpected files: {', '.join(extras)}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify a DeployMate review packet manifest.")
    parser.add_argument("packet_dir", nargs="?", default="dist/review")
    parser.add_argument(
        "--no-strict",
        action="store_true",
        help="Allow files that are not listed in MANIFEST.json.",
    )
    args = parser.parse_args()

    packet_dir = Path(args.packet_dir).resolve()
    errors = verify_packet(packet_dir, strict=not args.no_strict)
    if errors:
        for error in errors:
            print(f"[review-packet-verify] {error}", file=sys.stderr)
        return 1

    manifest = json.loads((packet_dir / "MANIFEST.json").read_text(encoding="utf-8"))
    print(f"[review-packet-verify] ok {packet_dir}")
    print(f"[review-packet-verify] files {len(manifest['files'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
