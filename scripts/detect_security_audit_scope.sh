#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -eq 0 ]; then
  printf 'security_audit_scope=full\n'
  printf 'run_release_workflow_audit=1\n'
  printf 'run_server_credentials_audit=1\n'
  printf 'reason=no changed files provided\n'
  exit 0
fi

security_scope="changed"
run_release_workflow_audit=0
run_server_credentials_audit=0
reason="changed files limited to local verification scope"

for path in "$@"; do
  case "$path" in
    .github/*|RUNBOOK.md|SAFE-RELEASE.md|scripts/release_workflow.sh|scripts/release_workflow_audit.sh|scripts/remote_release.sh|scripts/preflight.sh|scripts/security_audit.sh)
      security_scope="full"
      run_release_workflow_audit=1
      reason="release workflow contract changed"
      ;;
    backend/app/db.py|backend/app/routes/servers.py|backend/app/routes/ops.py|backend/app/services/server_credentials.py|backend/app/services/runtime_executors.py|backend/tests/test_server_credentials.py|backend/tests/test_server_credentials_policy.py|scripts/server_credentials_audit.sh)
      run_server_credentials_audit=1
      if [ "$reason" = "changed files limited to local verification scope" ]; then
        reason="server credentials contract changed"
      fi
      ;;
    docker-compose.yml|docker-compose.prod.yml|.env.production.example|frontend/Dockerfile|deploy/*|infra/*|scripts/runtime_capability_audit.sh|scripts/local_runtime_audit.sh)
      security_scope="full"
      if [ "$reason" = "changed files limited to local verification scope" ]; then
        reason="runtime or deploy contract changed"
      fi
      ;;
  esac
done

printf 'security_audit_scope=%s\n' "$security_scope"
printf 'run_release_workflow_audit=%s\n' "$run_release_workflow_audit"
printf 'run_server_credentials_audit=%s\n' "$run_server_credentials_audit"
printf 'reason=%s\n' "$reason"
