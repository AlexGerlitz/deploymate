#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TARGET_ENVIRONMENT="${TARGET_ENVIRONMENT:-production}"
OUTPUT_DIR="deploy-key-recovery"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/deploy_key_recovery_packet.sh [options]

Options:
  --target-environment <name>  Environment name. Defaults to TARGET_ENVIRONMENT or production.
  --output-dir <dir>           Output directory. Defaults to deploy-key-recovery.
  -h, --help                   Show this help.

Required environment:
  DEPLOY_SSH_PRIVATE_KEY       GitHub Actions deploy private key secret.

The packet contains only derived public-key material and fingerprints. It never
writes the private key into the output directory.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target-environment)
      TARGET_ENVIRONMENT="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[deploy-key-recovery] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$TARGET_ENVIRONMENT" ]; then
  echo "[deploy-key-recovery] target environment must not be empty" >&2
  exit 1
fi

if [ -z "${DEPLOY_SSH_PRIVATE_KEY:-}" ]; then
  echo "[deploy-key-recovery] DEPLOY_SSH_PRIVATE_KEY is required" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

private_key_path="$tmp_dir/deploy_key"
public_key_path="$tmp_dir/deploy_key.pub"

umask 077
printf '%s\n' "$DEPLOY_SSH_PRIVATE_KEY" > "$private_key_path"
chmod 600 "$private_key_path"

if ! ssh-keygen -y -f "$private_key_path" > "$public_key_path"; then
  echo "[deploy-key-recovery] failed to derive public key from DEPLOY_SSH_PRIVATE_KEY" >&2
  exit 1
fi

public_key="$(awk '{print $1" "$2}' "$public_key_path")"
key_type="$(awk '{print $1}' "$public_key_path")"
fingerprint_line="$(ssh-keygen -lf "$public_key_path")"
fingerprint="$(awk '{print $2}' <<< "$fingerprint_line")"
comment="deploymate-${TARGET_ENVIRONMENT}-github-actions"
authorized_keys_line="${public_key} ${comment}"
generated_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
repo="${GITHUB_REPOSITORY:-unavailable}"
run_url=""
if [ -n "${GITHUB_SERVER_URL:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ] && [ -n "${GITHUB_RUN_ID:-}" ]; then
  run_url="${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
fi

mkdir -p "$OUTPUT_DIR"

RECOVERY_GENERATED_AT="$generated_at" \
RECOVERY_REPO="$repo" \
RECOVERY_TARGET_ENVIRONMENT="$TARGET_ENVIRONMENT" \
RECOVERY_KEY_TYPE="$key_type" \
RECOVERY_FINGERPRINT="$fingerprint" \
RECOVERY_FINGERPRINT_LINE="$fingerprint_line" \
RECOVERY_PUBLIC_KEY="$public_key" \
RECOVERY_AUTHORIZED_KEYS_LINE="$authorized_keys_line" \
RECOVERY_RUN_URL="$run_url" \
python3 - "$OUTPUT_DIR" <<'PY'
import json
import os
import sys
from pathlib import Path

output_dir = Path(sys.argv[1])
payload = {
    "generated_at": os.environ["RECOVERY_GENERATED_AT"],
    "repo": os.environ["RECOVERY_REPO"],
    "target_environment": os.environ["RECOVERY_TARGET_ENVIRONMENT"],
    "key_type": os.environ["RECOVERY_KEY_TYPE"],
    "fingerprint": os.environ["RECOVERY_FINGERPRINT"],
    "fingerprint_line": os.environ["RECOVERY_FINGERPRINT_LINE"],
    "public_key": os.environ["RECOVERY_PUBLIC_KEY"],
    "authorized_keys_line": os.environ["RECOVERY_AUTHORIZED_KEYS_LINE"],
    "run_url": os.environ["RECOVERY_RUN_URL"],
}

(output_dir / "deploy-key-recovery.json").write_text(
    json.dumps(payload, indent=2) + "\n",
    encoding="utf-8",
)

markdown = f"""# DeployMate Deploy Key Recovery Packet

| Field | Value |
| --- | --- |
| Repository | `{payload['repo']}` |
| Target environment | `{payload['target_environment']}` |
| Generated at | `{payload['generated_at']}` |
| Key type | `{payload['key_type']}` |
| Public key fingerprint | `{payload['fingerprint']}` |
| Workflow run | `{payload['run_url'] or 'unavailable'}` |

This packet contains only public-key material derived from the GitHub Actions
`DEPLOY_SSH_PRIVATE_KEY` environment secret. It does not contain the private key.

## authorized_keys Line

```text
{payload['authorized_keys_line']}
```

## Repair Steps

1. Install the `authorized_keys` line for the deploy user on the target host.
2. Re-run `Release Secrets Audit` manually for `{payload['target_environment']}`.
3. Keep release pauses active until the manual audit succeeds.
4. Close the matching release incident only after the green audit is attached.
"""

(output_dir / "deploy-key-recovery.md").write_text(markdown, encoding="utf-8")
PY

echo "[deploy-key-recovery] wrote $OUTPUT_DIR"
echo "[deploy-key-recovery] fingerprint $fingerprint"
