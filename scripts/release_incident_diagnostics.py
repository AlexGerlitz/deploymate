#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
import sys
from typing import Any


UNKNOWN_CATEGORY = "unavailable"
UNKNOWN_HINT = ""


def _body_texts(issue_payload: dict[str, Any]) -> list[str]:
    texts: list[str] = []
    comments = issue_payload.get("comments")
    if isinstance(comments, list):
        for comment in reversed(comments):
            body = comment.get("body") if isinstance(comment, dict) else ""
            if body:
                texts.append(str(body))

    body = issue_payload.get("body")
    if body:
        texts.append(str(body))
    return texts


def _first_match(pattern: str, texts: list[str], *, flags: int = re.IGNORECASE) -> str:
    for text in texts:
        match = re.search(pattern, text, flags)
        if match:
            return " ".join(match.group(1).strip().split())
    return ""


def extract_issue_diagnostics(issue_payload: dict[str, Any]) -> dict[str, str]:
    texts = _body_texts(issue_payload)
    failure_category = _first_match(r"Current verified blocker[^:]*:\s*`([^`]+)`", texts)

    if not failure_category:
        failure_category = _first_match(r"Failure category:\s*`([^`]+)`", texts)

    if not failure_category:
        joined = "\n".join(texts).lower()
        if "remote host identification has changed" in joined or "known_hosts drift" in joined:
            failure_category = "ssh_host_key_changed"
        elif "permission denied (publickey,password)" in joined:
            failure_category = "ssh_auth_denied"

    operator_hint = _first_match(r"Meaning:\s*([\s\S]+?)(?:\n\n|$)", texts, flags=re.IGNORECASE)
    if not operator_hint:
        operator_hint = _first_match(r"Operator hint:\s*([^\n]+)", texts)

    return {
        "state": str(issue_payload.get("state") or "unknown"),
        "failure_category": failure_category or UNKNOWN_CATEGORY,
        "operator_hint": operator_hint or UNKNOWN_HINT,
    }


def _shell_escape(value: str) -> str:
    return value.replace("\n", " ").replace("\r", " ").strip()


def render_shell(payload: dict[str, str]) -> str:
    return "".join(f"{key}={_shell_escape(value)}\n" for key, value in payload.items())


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract safe release incident diagnostics from GitHub issue JSON.")
    parser.add_argument("--format", choices=("json", "shell"), default="shell")
    args = parser.parse_args()

    try:
        issue_payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"[release-incident-diagnostics] invalid issue json: {exc}", file=sys.stderr)
        return 2

    diagnostics = extract_issue_diagnostics(issue_payload)
    if args.format == "json":
        json.dump(diagnostics, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    sys.stdout.write(render_shell(diagnostics))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
