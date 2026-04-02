#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/prepare_known_hosts.sh --host <host> [--port <port>] [--output <path>]
  bash scripts/prepare_known_hosts.sh --host <host> --port <port> --types rsa,ecdsa,ed25519

Options:
  --host <host>      SSH host or IP to scan. Required.
  --port <port>      SSH port. Default: 22.
  --output <path>    known_hosts file to update. Default: ~/.deploymate_known_hosts
  --types <list>     Comma-separated key types for ssh-keyscan. Default: rsa,ecdsa,ed25519.

This script:
  - fetches host keys with ssh-keyscan
  - writes or updates the target known_hosts file without duplicate lines
  - prints ssh-keygen fingerprints for the scanned entries
EOF
}

HOST=""
PORT="22"
OUTPUT="${HOME}/.deploymate_known_hosts"
KEY_TYPES="rsa,ecdsa,ed25519"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT="${2:-}"
      shift 2
      ;;
    --types)
      KEY_TYPES="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[known-hosts] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$HOST" ]; then
  echo "[known-hosts] --host is required" >&2
  usage >&2
  exit 1
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "[known-hosts] invalid --port: $PORT" >&2
  exit 1
fi

OUTPUT_DIR="$(dirname "$OUTPUT")"
mkdir -p "$OUTPUT_DIR"
touch "$OUTPUT"
chmod 600 "$OUTPUT"

TMP_SCAN="$(mktemp)"
TMP_MERGED="$(mktemp)"

cleanup() {
  rm -f "$TMP_SCAN" "$TMP_MERGED"
}

trap cleanup EXIT

echo "[known-hosts] scanning $HOST:$PORT"
if ! ssh-keyscan -p "$PORT" -t "$KEY_TYPES" "$HOST" >"$TMP_SCAN" 2>/dev/null; then
  echo "[known-hosts] ssh-keyscan failed for $HOST:$PORT" >&2
  exit 1
fi

if [ ! -s "$TMP_SCAN" ]; then
  echo "[known-hosts] no host keys returned for $HOST:$PORT" >&2
  exit 1
fi

cat "$OUTPUT" "$TMP_SCAN" | awk 'NF && !seen[$0]++' >"$TMP_MERGED"
mv "$TMP_MERGED" "$OUTPUT"
chmod 600 "$OUTPUT"

echo "[known-hosts] fingerprints"
ssh-keygen -lf "$TMP_SCAN"
echo "[known-hosts] updated $OUTPUT"
