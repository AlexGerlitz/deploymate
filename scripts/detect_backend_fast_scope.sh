#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$#" -eq 0 ]; then
  printf 'backend_fast_mode=safety\n'
  printf 'reason=no changed files provided\n'
  exit 0
fi

backend_paths=()
requires_safety=0
has_backend_scope=0
reason="shared diff without backend app impact"

for path in "$@"; do
  case "$path" in
    backend/*)
      backend_paths+=("$path")
      has_backend_scope=1
      reason="backend files changed"
      ;;
    docker-compose.yml|docker-compose.prod.yml|.env.production.example|frontend/Dockerfile|deploy/*|infra/*|scripts/runtime_capability_audit.sh|scripts/local_runtime_audit.sh|scripts/security_audit.sh|scripts/preflight.sh|scripts/release_workflow.sh|scripts/remote_release.sh|scripts/post_deploy_smoke.sh)
      requires_safety=1
      has_backend_scope=1
      reason="shared release or runtime contract changed"
      ;;
    .github/*|README.md|RUNBOOK.md|HANDOFF.md|LICENSE|NOTICE|COMMERCIAL-LICENSE.md|docs/*|frontend/*)
      ;;
    *)
      requires_safety=1
      has_backend_scope=1
      reason="shared repository file changed"
      ;;
  esac
done

if [ "$has_backend_scope" = "0" ]; then
  printf 'backend_fast_mode=skip\n'
  printf 'reason=%s\n' "$reason"
  exit 0
fi

if [ "$requires_safety" = "1" ]; then
  printf 'backend_fast_mode=safety\n'
  printf 'reason=%s\n' "$reason"
  exit 0
fi

targets="$(bash "$ROOT_DIR/scripts/detect_backend_test_targets.sh" "${backend_paths[@]}" | tr '\n' ' ' | xargs)"
printf 'backend_fast_mode=targeted\n'
printf 'backend_fast_modules=%s\n' "$targets"
printf 'reason=%s\n' "$reason"
