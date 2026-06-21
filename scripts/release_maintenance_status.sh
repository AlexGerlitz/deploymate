#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="${GITHUB_REPOSITORY:-AlexGerlitz/deploymate}"
HOSTS="deploymatecloud.ru,lab.deploymatecloud.ru"
CHECK_NETWORK=1
REQUIRE_READY=0
OUTPUT_FORMAT="human"
GENERATED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
status_keys=()
status_values=()

usage() {
  cat <<'EOF'
Usage:
  bash scripts/release_maintenance_status.sh [options]

Options:
  --repo <owner/name>       GitHub repository to inspect. Defaults to GITHUB_REPOSITORY or AlexGerlitz/deploymate.
  --hosts <h1,h2>           Comma-separated public hosts to check.
  --no-network              Skip DNS and HTTPS probes.
  --require-ready           Exit non-zero unless all pauses are off, incidents are closed, and public hosts are healthy.
  --format human|shell|json|markdown Output format.

This script is read-only. It does not read GitHub secrets and does not change remote hosts.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      REPO="${2:-}"
      shift 2
      ;;
    --hosts)
      HOSTS="${2:-}"
      shift 2
      ;;
    --no-network)
      CHECK_NETWORK=0
      shift
      ;;
    --require-ready)
      REQUIRE_READY=1
      shift
      ;;
    --format)
      OUTPUT_FORMAT="${2:-human}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[release-maintenance-status] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$REPO" ]; then
  echo "[release-maintenance-status] --repo must not be empty" >&2
  exit 1
fi

if [ "$OUTPUT_FORMAT" != "human" ] && [ "$OUTPUT_FORMAT" != "shell" ] && [ "$OUTPUT_FORMAT" != "json" ] && [ "$OUTPUT_FORMAT" != "markdown" ]; then
  echo "[release-maintenance-status] --format must be human, shell, json, or markdown" >&2
  exit 1
fi

if [ "$OUTPUT_FORMAT" = "json" ] && ! command -v python3 >/dev/null 2>&1; then
  echo "[release-maintenance-status] python3 is required for json output" >&2
  exit 1
fi

ready=1
reasons=()

mark_not_ready() {
  ready=0
  reasons+=("$1")
}

emit_human() {
  if [ "$OUTPUT_FORMAT" = "human" ]; then
    printf '%s\n' "$1"
  fi
}

emit_shell() {
  status_keys+=("$1")
  status_values+=("$2")
  if [ "$OUTPUT_FORMAT" = "shell" ]; then
    printf '%s=%s\n' "$1" "$2"
  fi
}

json_string() {
  python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$1"
}

emit_json() {
  local i
  printf '{\n'
  for i in "${!status_keys[@]}"; do
    printf '  %s: %s' "$(json_string "${status_keys[$i]}")" "$(json_string "${status_values[$i]}")"
    if [ "$i" -lt "$((${#status_keys[@]} - 1))" ]; then
      printf ','
    fi
    printf '\n'
  done
  printf '}\n'
}

status_value() {
  local key="$1"
  local i
  for i in "${!status_keys[@]}"; do
    if [ "${status_keys[$i]}" = "$key" ]; then
      printf '%s' "${status_values[$i]}"
      return 0
    fi
  done
  return 0
}

emit_markdown() {
  local ready_value blocker_count issue_18 issue_19 release_pause staging_pause
  local issue_18_category issue_19_category issue_18_hint issue_19_hint
  ready_value="$(status_value ready_for_unpause)"
  blocker_count="$(status_value blocker_count)"
  issue_18="$(status_value issue_18_state)"
  issue_19="$(status_value issue_19_state)"
  release_pause="$(status_value release_audit_scheduled_paused)"
  staging_pause="$(status_value staging_release_paused)"
  issue_18_category="$(status_value issue_18_failure_category)"
  issue_19_category="$(status_value issue_19_failure_category)"
  issue_18_hint="$(status_value issue_18_operator_hint)"
  issue_19_hint="$(status_value issue_19_operator_hint)"

  printf '# Release Maintenance Status\n\n'
  printf '| Check | Value |\n'
  printf '| --- | --- |\n'
  printf '| Generated at | `%s` |\n' "$GENERATED_AT"
  printf '| Repository | `%s` |\n' "$(status_value repo)"
  printf '| Ready for unpause | `%s` |\n' "$ready_value"
  printf '| Release audit schedule paused | `%s` |\n' "$release_pause"
  printf '| Staging release paused | `%s` |\n' "$staging_pause"
  printf '| Issue #18 | `%s` |\n' "$issue_18"
  printf '| Issue #19 | `%s` |\n' "$issue_19"
  printf '\n'

  printf '## Network\n\n'
  if [ "$(status_value network_checks)" = "skipped" ]; then
    printf '%s\n\n' '- Network checks were skipped for this run.'
  else
    printf '| Host | DNS | HTTPS | Remote IP |\n'
    printf '| --- | --- | --- | --- |\n'
    IFS=',' read -r -a markdown_host_list <<< "$HOSTS"
    for host in "${markdown_host_list[@]}"; do
      host="$(printf '%s' "$host" | xargs)"
      [ -n "$host" ] || continue
      key="$(safe_key "$host")"
      printf '| `%s` | `%s` | `%s` | `%s` |\n' \
        "$host" \
        "$(status_value "host_${key}_dns")" \
        "$(status_value "host_${key}_https_code")" \
        "$(status_value "host_${key}_remote_ip")"
    done
    printf '\n'
  fi

  printf '## Blockers\n\n'
  if [ -z "$blocker_count" ] || [ "$blocker_count" = "0" ]; then
    printf '%s\n' '- None.'
  else
    local i
    i=1
    while [ "$i" -le "$blocker_count" ]; do
      printf '%s\n' "- $(status_value "blocker_${i}")"
      i=$((i + 1))
    done
  fi

  printf '\n\n## Incident Diagnostics\n\n'
  printf '| Issue | State | Failure category | Operator hint |\n'
  printf '| --- | --- | --- | --- |\n'
  printf '| `#18` | `%s` | `%s` | %s |\n' "$issue_18" "${issue_18_category:-unavailable}" "$(md_cell "${issue_18_hint:-}")"
  printf '| `#19` | `%s` | `%s` | %s |\n' "$issue_19" "${issue_19_category:-unavailable}" "$(md_cell "${issue_19_hint:-}")"
}

safe_key() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9_]+/_/g; s/^_+//; s/_+$//'
}

md_cell() {
  local value="$1"
  value="$(printf '%s' "$value" | tr '\r\n' ' ' | sed 's/  */ /g; s/|/\\|/g; s/^ *//; s/ *$//')"
  if [ -z "$value" ]; then
    printf '`%s`' "unavailable"
  else
    printf '%s' "$value"
  fi
}

gh_available=0
if command -v gh >/dev/null 2>&1; then
  gh_available=1
fi

get_repo_variable() {
  local name="$1"
  local env_value="${!name:-}"
  if [ -n "$env_value" ]; then
    printf '%s\n' "$env_value"
    return 0
  fi
  if [ "$gh_available" != "1" ]; then
    return 0
  fi
  gh variable list --repo "$REPO" 2>/dev/null | awk -v name="$name" '$1 == name { print $2; found=1 } END { if (!found) print "" }'
}

get_issue_diagnostics_json() {
  local issue="$1"
  if [ "$gh_available" != "1" ] || ! command -v python3 >/dev/null 2>&1; then
    printf '{}\n'
    return 0
  fi
  gh issue view "$issue" --repo "$REPO" --json state,body,comments 2>/dev/null \
    | python3 "$ROOT_DIR/scripts/release_incident_diagnostics.py" --format json 2>/dev/null \
    || printf '{}\n'
}

json_field() {
  local payload="$1"
  local key="$2"
  PAYLOAD="$payload" python3 - "$key" <<'PY' 2>/dev/null || true
import json
import os
import sys

key = sys.argv[1]
try:
    payload = json.loads(os.environ.get("PAYLOAD", "{}"))
except json.JSONDecodeError:
    payload = {}
print(payload.get(key, ""))
PY
}

emit_human "[release-maintenance-status] repo: $REPO"
emit_shell "repo" "$REPO"
emit_shell "generated_at" "$GENERATED_AT"

if [ "$gh_available" != "1" ]; then
  emit_human "[release-maintenance-status] gh: unavailable"
  emit_shell "gh_available" "0"
  mark_not_ready "gh unavailable"
else
  emit_shell "gh_available" "1"
fi

release_audit_paused="$(get_repo_variable RELEASE_AUDIT_SCHEDULED_PAUSED)"
staging_release_paused="$(get_repo_variable STAGING_RELEASE_PAUSED)"

release_audit_paused="${release_audit_paused:-false}"
staging_release_paused="${staging_release_paused:-false}"

emit_human "[release-maintenance-status] RELEASE_AUDIT_SCHEDULED_PAUSED=$release_audit_paused"
emit_human "[release-maintenance-status] STAGING_RELEASE_PAUSED=$staging_release_paused"
emit_shell "release_audit_scheduled_paused" "$release_audit_paused"
emit_shell "staging_release_paused" "$staging_release_paused"

if [ "$release_audit_paused" = "true" ]; then
  mark_not_ready "release audit schedule paused"
fi

if [ "$staging_release_paused" = "true" ]; then
  mark_not_ready "staging release paused"
fi

for issue in 18 19; do
  diagnostics_json="$(get_issue_diagnostics_json "$issue")"
  state="$(json_field "$diagnostics_json" state)"
  failure_category="$(json_field "$diagnostics_json" failure_category)"
  operator_hint="$(json_field "$diagnostics_json" operator_hint)"
  state="${state:-unknown}"
  failure_category="${failure_category:-unavailable}"
  operator_hint="${operator_hint:-}"

  emit_human "[release-maintenance-status] issue #$issue state=$state"
  emit_human "[release-maintenance-status] issue #$issue failure_category=$failure_category"
  emit_shell "issue_${issue}_state" "$state"
  emit_shell "issue_${issue}_failure_category" "$failure_category"
  emit_shell "issue_${issue}_operator_hint" "$operator_hint"
  if [ "$state" != "CLOSED" ]; then
    mark_not_ready "issue #$issue is $state"
  fi
done

if [ "$CHECK_NETWORK" = "1" ]; then
  emit_shell "network_checks" "enabled"
  IFS=',' read -r -a host_list <<< "$HOSTS"
  for host in "${host_list[@]}"; do
    host="$(printf '%s' "$host" | xargs)"
    [ -n "$host" ] || continue
    key="$(safe_key "$host")"

    dns_value=""
    if command -v dig >/dev/null 2>&1; then
      dns_value="$(dig +time=2 +tries=1 +short A "$host" 2>/dev/null \
        | awk '/^[0-9.]+$/ { print }' \
        | paste -sd ',' - \
        || true)"
    fi

    http_code="000"
    remote_ip=""
    if command -v curl >/dev/null 2>&1; then
      curl_output="$(curl -k -L --max-time 5 -sS -o /tmp/deploymate-release-maintenance-status.out -w 'code=%{http_code} remote=%{remote_ip}' "https://${host}" 2>/dev/null || true)"
      http_code="$(printf '%s\n' "$curl_output" | sed -nE 's/.*code=([0-9]{3}).*/\1/p')"
      remote_ip="$(printf '%s\n' "$curl_output" | sed -nE 's/.*remote=([^ ]*).*/\1/p')"
      rm -f /tmp/deploymate-release-maintenance-status.out
    fi

    dns_value="${dns_value:-unavailable}"
    http_code="${http_code:-000}"
    remote_ip="${remote_ip:-unavailable}"

    emit_human "[release-maintenance-status] host=$host dns=$dns_value https=$http_code remote=$remote_ip"
    emit_shell "host_${key}_dns" "$dns_value"
    emit_shell "host_${key}_https_code" "$http_code"
    emit_shell "host_${key}_remote_ip" "$remote_ip"

    case "$http_code" in
      2*|3*)
        ;;
      *)
        mark_not_ready "host $host https=$http_code"
        ;;
    esac
  done
else
  emit_human "[release-maintenance-status] network checks skipped"
  emit_shell "network_checks" "skipped"
fi

if [ "$ready" = "1" ]; then
  emit_human "[release-maintenance-status] ready_for_unpause=yes"
  emit_shell "ready_for_unpause" "1"
  emit_shell "blocker_count" "0"
else
  emit_human "[release-maintenance-status] ready_for_unpause=no"
  emit_shell "ready_for_unpause" "0"
  emit_shell "blocker_count" "${#reasons[@]}"
  blocker_index=1
  for reason in "${reasons[@]}"; do
    emit_human "[release-maintenance-status] blocker: $reason"
    emit_shell "blocker_${blocker_index}" "$reason"
    blocker_index=$((blocker_index + 1))
  done
fi

if [ "$OUTPUT_FORMAT" = "json" ]; then
  emit_json
fi

if [ "$OUTPUT_FORMAT" = "markdown" ]; then
  emit_markdown
fi

if [ "$REQUIRE_READY" = "1" ] && [ "$ready" != "1" ]; then
  exit 1
fi
