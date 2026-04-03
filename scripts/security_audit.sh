#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/audit_cache.sh"
cd "$ROOT_DIR"

audit_cache_prepare

if audit_cache_has security_audit; then
  echo "[security-audit] already completed in this run; skipping"
  audit_cache_record_event run_hit security_audit
  exit 0
fi

if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD=(rg -n -S)
else
  SEARCH_CMD=(grep -nE)
fi

TMP_FILE="$(mktemp)"
cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT

echo "[security-audit] repo: $ROOT_DIR"

TRACKED_FILES=()
if [ "${DEPLOYMATE_SECURITY_AUDIT_SCOPE:-full}" = "changed" ] && [ -n "${DEPLOYMATE_CHANGED_FILES:-}" ]; then
  while IFS= read -r file; do
    [ -n "$file" ] && [ -f "$file" ] && TRACKED_FILES+=("$file")
  done <<< "$DEPLOYMATE_CHANGED_FILES"
  echo "[security-audit] file scope: changed files"
else
  while IFS= read -r file; do
    TRACKED_FILES+=("$file")
  done < <(git ls-files)
  echo "[security-audit] file scope: full tracked files"
fi

if [ "${#TRACKED_FILES[@]}" -eq 0 ]; then
  echo "[security-audit] no files in current scope"
  exit 0
fi

FILTERED_FILES=()
for file in "${TRACKED_FILES[@]}"; do
  case "$file" in
    .env.production.example|frontend/.env.example|frontend/package-lock.json)
      continue
      ;;
    *)
      FILTERED_FILES+=("$file")
      ;;
  esac
done

security_phase_cache_key="security_audit_phase"
security_phase_metadata="$(printf 'scope=%s\nsecret_scope=%s\nruntime_policy_scope=%s\nrun_release=%s\nrun_server_credentials=%s\nrun_runtime_audits=%s\nchanged=%s\n' \
  "${DEPLOYMATE_SECURITY_AUDIT_SCOPE:-full}" \
  "${DEPLOYMATE_SECRET_SCAN_SCOPE:-${DEPLOYMATE_SECURITY_AUDIT_SCOPE:-full}}" \
  "${DEPLOYMATE_RUNTIME_POLICY_SCAN_SCOPE:-skip}" \
  "${DEPLOYMATE_RUN_RELEASE_WORKFLOW_AUDIT:-1}" \
  "${DEPLOYMATE_RUN_SERVER_CREDENTIALS_AUDIT:-1}" \
  "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" \
  "${DEPLOYMATE_CHANGED_FILES:-}")"
security_phase_files=(
  "scripts/security_audit.sh"
  "scripts/detect_security_audit_scope.sh"
  "scripts/release_workflow_audit.sh"
  "scripts/server_credentials_audit.sh"
  "scripts/local_runtime_audit.sh"
  "scripts/runtime_capability_audit.sh"
  "scripts/audit_cache.sh"
  "scripts/project_automation_targets.sh"
  "scripts/project_automation_config.sh"
)
for file in "${FILTERED_FILES[@]}"; do
  security_phase_files+=("$file")
done
security_phase_fingerprint="$(audit_cache_fingerprint_inputs "$security_phase_cache_key" "$security_phase_metadata" "${security_phase_files[@]}")"
if audit_cache_persistent_has "$security_phase_cache_key" "$security_phase_fingerprint"; then
  echo "[security-audit] phase cache hit"
  audit_cache_record_event phase_hit "$security_phase_cache_key"
  audit_cache_mark security_audit
  exit 0
fi
echo "[security-audit] phase cache miss"
audit_cache_record_event phase_miss "$security_phase_cache_key"

echo "[security-audit] scanning tracked files for high-signal secret patterns"
echo "[security-audit] secret scan scope: ${DEPLOYMATE_SECRET_SCAN_SCOPE:-${DEPLOYMATE_SECURITY_AUDIT_SCOPE:-full}}"
secret_seed="secret:${DEPLOYMATE_SECRET_SCAN_SCOPE:-${DEPLOYMATE_SECURITY_AUDIT_SCOPE:-full}}"
secret_fingerprint="$(audit_cache_fingerprint_files "$secret_seed" "${FILTERED_FILES[@]}")"
if audit_cache_persistent_has "security_secret_scan" "$secret_fingerprint"; then
  echo "[security-audit] secret scan cache hit"
  audit_cache_record_event persistent_hit security_secret_scan
else
  audit_cache_record_event persistent_miss security_secret_scan
  if "${SEARCH_CMD[@]}" \
    -e 'gh[opusr]_[A-Za-z0-9_]+' \
    -e 'github_pat_[A-Za-z0-9_]+' \
    -e 'AKIA[0-9A-Z]{16}' \
    -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
    -e 'xox[baprs]-[A-Za-z0-9-]+' \
    -e 'sk_live_[A-Za-z0-9]+' \
    -- "${FILTERED_FILES[@]}" >"$TMP_FILE"; then
    echo "[security-audit] potential secret material found:"
    cat "$TMP_FILE"
    exit 1
  fi
  audit_cache_persistent_mark "security_secret_scan" "$secret_fingerprint"
fi

echo "[security-audit] scanning for risky runtime defaults"
echo "[security-audit] runtime policy scan scope: ${DEPLOYMATE_RUNTIME_POLICY_SCAN_SCOPE:-skip}"

WARNINGS=0
RUNTIME_FILES=()
if [ "${DEPLOYMATE_RUNTIME_POLICY_SCAN_SCOPE:-skip}" = "skip" ]; then
  echo "[security-audit] risky runtime defaults scan skipped for this local diff"
else
  for file in "${FILTERED_FILES[@]}"; do
    case "$file" in
      docker-compose.yml|docker-compose.prod.yml|.env.production.example|frontend/Dockerfile|deploy/*|infra/*|scripts/runtime_capability_audit.sh|scripts/local_runtime_audit.sh|scripts/post_deploy_smoke.sh|backend/app/routes/deployments.py|backend/app/routes/ops.py|backend/app/routes/servers.py|backend/app/services/runtime_executors.py|backend/tests/test_deployment_ssh_options.py)
        RUNTIME_FILES+=("$file")
        ;;
    esac
  done

  if [ "${#RUNTIME_FILES[@]}" -eq 0 ]; then
    echo "[security-audit] no runtime policy files in current scope"
  else
    runtime_seed="runtime-policy:${DEPLOYMATE_RUNTIME_POLICY_SCAN_SCOPE:-skip}"
    runtime_fingerprint="$(audit_cache_fingerprint_files "$runtime_seed" "${RUNTIME_FILES[@]}")"
    if audit_cache_persistent_has "security_runtime_policy_scan" "$runtime_fingerprint"; then
      echo "[security-audit] runtime policy scan cache hit"
      audit_cache_record_event persistent_hit security_runtime_policy_scan
    else
      audit_cache_record_event persistent_miss security_runtime_policy_scan
      if "${SEARCH_CMD[@]}" 'StrictHostKeyChecking=no' -- "${RUNTIME_FILES[@]}" >"$TMP_FILE"; then
        echo "[security-audit] warning: StrictHostKeyChecking=no found"
        cat "$TMP_FILE"
        WARNINGS=1
      fi

      if "${SEARCH_CMD[@]}" '/var/run/docker.sock' -- "${RUNTIME_FILES[@]}" >"$TMP_FILE"; then
        echo "[security-audit] warning: docker.sock reference found"
        cat "$TMP_FILE"
        WARNINGS=1
      fi

      if [ "$WARNINGS" -eq 0 ]; then
        audit_cache_persistent_mark "security_runtime_policy_scan" "$runtime_fingerprint"
      fi
    fi
  fi
fi

if [ -f "scripts/release_workflow_audit.sh" ] && [ "${DEPLOYMATE_RUN_RELEASE_WORKFLOW_AUDIT:-1}" = "1" ]; then
  echo "[security-audit] release workflow audit"
  bash scripts/release_workflow_audit.sh
elif [ -f "scripts/release_workflow_audit.sh" ]; then
  echo "[security-audit] release workflow audit skipped for this local diff"
fi

if [ -f "scripts/server_credentials_audit.sh" ] && [ "${DEPLOYMATE_RUN_SERVER_CREDENTIALS_AUDIT:-1}" = "1" ]; then
  echo "[security-audit] server credentials audit"
  bash scripts/server_credentials_audit.sh
elif [ -f "scripts/server_credentials_audit.sh" ]; then
  echo "[security-audit] server credentials audit skipped for this local diff"
fi

if [ -f "scripts/local_runtime_audit.sh" ]; then
  if [ "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" = "1" ]; then
    echo "[security-audit] local runtime audit"
    bash scripts/local_runtime_audit.sh
  else
    echo "[security-audit] local runtime audit skipped for this local diff"
  fi
fi

if [ -f "scripts/runtime_capability_audit.sh" ]; then
  if [ "${DEPLOYMATE_RUN_RUNTIME_AUDITS:-1}" = "1" ]; then
    echo "[security-audit] runtime capability audit"
    bash scripts/runtime_capability_audit.sh
  else
    echo "[security-audit] runtime capability audit skipped for this local diff"
  fi
fi

if [ "$WARNINGS" -eq 0 ]; then
  echo "[security-audit] no high-risk findings"
  audit_cache_persistent_mark "$security_phase_cache_key" "$security_phase_fingerprint"
else
  echo "[security-audit] warnings found; review recommended"
fi

audit_cache_mark security_audit
