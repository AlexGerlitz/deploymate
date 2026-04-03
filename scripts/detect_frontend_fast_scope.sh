#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ "$#" -eq 0 ]; then
  printf 'frontend_fast_mode=default\n'
  printf 'frontend_fast_smokes=auth ops runtime\n'
  printf 'reason=no changed files provided\n'
  exit 0
fi

frontend_paths=()
requires_default=0
has_frontend_scope=0
reason="shared diff without frontend app impact"

for path in "$@"; do
  case "$path" in
    frontend/*)
      frontend_paths+=("$path")
      has_frontend_scope=1
      reason="frontend files changed"
      ;;
    frontend/Dockerfile|docker-compose.yml|docker-compose.prod.yml|deploy/*|infra/*|scripts/release_workflow.sh|scripts/preflight.sh|scripts/remote_release.sh|scripts/post_deploy_smoke.sh)
      requires_default=1
      has_frontend_scope=1
      reason="shared frontend delivery contract changed"
      ;;
    .github/*|README.md|RUNBOOK.md|HANDOFF.md|LICENSE|NOTICE|COMMERCIAL-LICENSE.md|docs/*|backend/*)
      ;;
    *)
      requires_default=1
      has_frontend_scope=1
      reason="shared repository file changed"
      ;;
  esac
done

if [ "$has_frontend_scope" = "0" ]; then
  printf 'frontend_fast_mode=skip\n'
  printf 'reason=%s\n' "$reason"
  exit 0
fi

if [ "$requires_default" = "1" ]; then
  printf 'frontend_fast_mode=default\n'
  printf 'frontend_fast_smokes=auth ops runtime\n'
  printf 'reason=%s\n' "$reason"
  exit 0
fi

targets="$(bash "$ROOT_DIR/scripts/detect_frontend_smoke_targets.sh" "${frontend_paths[@]}" | tr '\n' ' ' | xargs)"
printf 'frontend_fast_mode=targeted\n'
printf 'frontend_fast_smokes=%s\n' "$targets"
printf 'reason=%s\n' "$reason"
