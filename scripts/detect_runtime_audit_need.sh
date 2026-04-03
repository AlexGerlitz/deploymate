#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -eq 0 ]; then
  printf 'run_runtime_audits=1\n'
  printf 'reason=no changed files provided\n'
  exit 0
fi

for path in "$@"; do
  case "$path" in
    docker-compose.yml|docker-compose.prod.yml|.env.production.example|frontend/Dockerfile|deploy/*|infra/*|backend/app/services/runtime_executors.py|scripts/runtime_capability_audit.sh|scripts/local_runtime_audit.sh|scripts/security_audit.sh|scripts/preflight.sh|scripts/release_workflow.sh|scripts/remote_release.sh)
      printf 'run_runtime_audits=1\n'
      printf 'reason=runtime or deploy contract changed\n'
      exit 0
      ;;
  esac
done

printf 'run_runtime_audits=0\n'
printf 'reason=runtime contract untouched\n'
