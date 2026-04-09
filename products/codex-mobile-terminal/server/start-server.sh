#!/usr/bin/env bash

set -euo pipefail

VPN_ENABLE="${WEB_TERMINAL_VPN_ENABLE:-0}"
VPN_BOOTSTRAP_SCRIPT="${WEB_TERMINAL_VPN_BOOTSTRAP_SCRIPT:-/vpn/bootstrap.sh}"
VPN_TEARDOWN_SCRIPT="${WEB_TERMINAL_VPN_TEARDOWN_SCRIPT:-/vpn/teardown.sh}"
VPN_NETWORK_TEST_HOST="${WEB_TERMINAL_VPN_NETWORK_TEST_HOST:-}"

cleanup() {
  if [[ "$VPN_ENABLE" == "1" && -x "$VPN_TEARDOWN_SCRIPT" ]]; then
    "$VPN_TEARDOWN_SCRIPT" || true
  fi
}

trap cleanup EXIT INT TERM

if [[ "$VPN_ENABLE" == "1" ]]; then
  if [[ ! -x "$VPN_BOOTSTRAP_SCRIPT" ]]; then
    printf 'Web Terminal VPN bootstrap script is missing or not executable: %s\n' "$VPN_BOOTSTRAP_SCRIPT" >&2
    exit 1
  fi

  "$VPN_BOOTSTRAP_SCRIPT"

  if [[ -n "$VPN_NETWORK_TEST_HOST" ]]; then
    if ! getent hosts "$VPN_NETWORK_TEST_HOST" >/dev/null 2>&1; then
      printf 'Web Terminal VPN network test failed for host: %s\n' "$VPN_NETWORK_TEST_HOST" >&2
      exit 1
    fi
  fi
fi

exec npm run start
