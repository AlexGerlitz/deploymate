#!/usr/bin/env bash

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-AlexGerlitz/deploymate}"
HOSTS="deploymatecloud.ru,lab.deploymatecloud.ru"
CHECK_NETWORK=1
REQUIRE_READY=0
OUTPUT_FORMAT="human"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/release_maintenance_status.sh [options]

Options:
  --repo <owner/name>       GitHub repository to inspect. Defaults to GITHUB_REPOSITORY or AlexGerlitz/deploymate.
  --hosts <h1,h2>           Comma-separated public hosts to check.
  --no-network              Skip DNS and HTTPS probes.
  --require-ready           Exit non-zero unless all pauses are off, incidents are closed, and public hosts are healthy.
  --format human|shell      Output format.

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

if [ "$OUTPUT_FORMAT" != "human" ] && [ "$OUTPUT_FORMAT" != "shell" ]; then
  echo "[release-maintenance-status] --format must be human or shell" >&2
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
  if [ "$OUTPUT_FORMAT" = "shell" ]; then
    printf '%s=%s\n' "$1" "$2"
  fi
}

safe_key() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9_]+/_/g; s/^_+//; s/_+$//'
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

get_issue_state() {
  local issue="$1"
  if [ "$gh_available" != "1" ]; then
    return 0
  fi
  gh issue view "$issue" --repo "$REPO" --json state -q .state 2>/dev/null || true
}

emit_human "[release-maintenance-status] repo: $REPO"
emit_shell "repo" "$REPO"

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
  state="$(get_issue_state "$issue")"
  state="${state:-unknown}"
  emit_human "[release-maintenance-status] issue #$issue state=$state"
  emit_shell "issue_${issue}_state" "$state"
  if [ "$state" != "CLOSED" ]; then
    mark_not_ready "issue #$issue is $state"
  fi
done

if [ "$CHECK_NETWORK" = "1" ]; then
  IFS=',' read -r -a host_list <<< "$HOSTS"
  for host in "${host_list[@]}"; do
    host="$(printf '%s' "$host" | xargs)"
    [ -n "$host" ] || continue
    key="$(safe_key "$host")"

    dns_value=""
    if command -v dig >/dev/null 2>&1; then
      dns_value="$(dig +short A "$host" | paste -sd ',' -)"
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
else
  emit_human "[release-maintenance-status] ready_for_unpause=no"
  emit_shell "ready_for_unpause" "0"
  for reason in "${reasons[@]}"; do
    emit_human "[release-maintenance-status] blocker: $reason"
  done
fi

if [ "$REQUIRE_READY" = "1" ] && [ "$ready" != "1" ]; then
  exit 1
fi
