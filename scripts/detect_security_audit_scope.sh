#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/project_automation_targets.sh"

if [ "$#" -eq 0 ]; then
  printf 'security_audit_scope=full\n'
  printf 'secret_scan_scope=full\n'
  printf 'runtime_policy_scan_scope=full\n'
  printf 'run_release_workflow_audit=1\n'
  printf 'run_server_credentials_audit=1\n'
  printf 'reason=no changed files provided\n'
  exit 0
fi

security_scope="changed"
secret_scan_scope="changed"
runtime_policy_scan_scope="skip"
run_release_workflow_audit=0
run_server_credentials_audit=0
reason="changed files limited to local verification scope"

for path in "$@"; do
  case "$(automation_security_scope_for_path "$path")" in
    release_workflow_contract)
      run_release_workflow_audit=1
      if [ "$path" = "scripts/security_audit.sh" ]; then
        runtime_policy_scan_scope="changed"
      fi
      reason="release workflow contract changed"
      ;;
    server_credentials_contract)
      run_server_credentials_audit=1
      if [ "$reason" = "changed files limited to local verification scope" ]; then
        reason="server credentials contract changed"
      fi
      ;;
    runtime_or_deploy_contract)
      security_scope="full"
      secret_scan_scope="full"
      runtime_policy_scan_scope="full"
      if [ "$reason" = "changed files limited to local verification scope" ]; then
        reason="runtime or deploy contract changed"
      fi
      ;;
    runtime_policy_file)
      runtime_policy_scan_scope="changed"
      if [ "$reason" = "changed files limited to local verification scope" ]; then
        reason="runtime policy files changed"
      fi
      ;;
  esac
done

printf 'security_audit_scope=%s\n' "$security_scope"
printf 'secret_scan_scope=%s\n' "$secret_scan_scope"
printf 'runtime_policy_scan_scope=%s\n' "$runtime_policy_scan_scope"
printf 'run_release_workflow_audit=%s\n' "$run_release_workflow_audit"
printf 'run_server_credentials_audit=%s\n' "$run_server_credentials_audit"
printf 'reason=%s\n' "$reason"
