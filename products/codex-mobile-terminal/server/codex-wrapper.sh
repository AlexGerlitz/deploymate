#!/usr/bin/env bash
set -euo pipefail

REAL_CODEX_BIN="/usr/local/bin/codex-real"
AUTH_ISSUER="https://auth.openai.com"
CODEX_CLIENT_ID="app_EMoamEEZ73f0CkXaXp7hrann"
API_KEY_ENV_FILE="${CODEX_API_KEY_ENV_PATH:-${HOME}/.config/codex-mobile-terminal/openai-api-key.env}"

is_remote_web_terminal() {
  [ -n "${CODEX_WEB_TERMINAL:-}" ] \
    || [ -n "${SSH_CONNECTION:-}" ] \
    || [ -n "${SSH_CLIENT:-}" ] \
    || [ -n "${SSH_TTY:-}" ]
}

has_auth() {
  [ -s "${HOME}/.codex/auth.json" ]
}

has_explicit_model_arg() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      -m|--model|--model=*|-m=*)
        return 0
        ;;
    esac
  done

  return 1
}

is_codex_subcommand() {
  case "${1:-}" in
    exec|review|login|logout|mcp|mcp-server|app-server|completion|sandbox|debug|apply|resume|fork|cloud|features|help)
      return 0
      ;;
  esac

  return 1
}

print_remote_auth_hint() {
  printf '\n'
  printf '%s\n' 'Remote/mobile Codex auth:'
  printf '%s\n' '- Browser login with localhost callback fails here.'
  printf '%s\n' '- In Codex press Esc and choose "Sign in with Device Code".'
  printf '%s\n' '- API key fallback: printenv OPENAI_API_KEY | codex login --with-api-key'
  printf '\n'
}

check_device_code_preflight() {
  local response http_code body error_code

  response="$(
    curl -sS -X POST "${AUTH_ISSUER}/api/accounts/deviceauth/usercode" \
      -H "Content-Type: application/json" \
      --data "{\"client_id\":\"${CODEX_CLIENT_ID}\"}" \
      -w $'\n%{http_code}' || true
  )"

  http_code="${response##*$'\n'}"
  body="${response%$'\n'*}"
  error_code="$(printf '%s' "${body}" | jq -r '.error.code // empty' 2>/dev/null || true)"

  if [ "${http_code}" = "403" ] && [ "${error_code}" = "unsupported_country_region_territory" ]; then
    printf '%s\n' 'ChatGPT device-code login is blocked for this server region.'
    printf '%s\n' 'Use API key auth instead: printenv OPENAI_API_KEY | codex login --with-api-key'
    return 1
  fi

  return 0
}

if [ ! -x "${REAL_CODEX_BIN}" ]; then
  echo "codex wrapper error: real launcher not found at ${REAL_CODEX_BIN}" >&2
  exit 1
fi

if [ -n "${CODEX_MOBILE_TERMINAL:-}" ]; then
  export CODEX_WEB_TERMINAL=1
fi

if [ -f "${API_KEY_ENV_FILE}" ]; then
  # Ensure direct `codex` launches also inherit the persisted API key.
  . "${API_KEY_ENV_FILE}"
fi

if is_remote_web_terminal && [ "$#" -eq 0 ] && ! has_auth; then
  print_remote_auth_hint
fi

if is_remote_web_terminal && [ "${1:-}" = "login" ]; then
  shift

  if [ "${1:-}" = "status" ]; then
    exec "${REAL_CODEX_BIN}" login status "$@"
  fi

  for arg in "$@"; do
    case "$arg" in
      --device-auth|--with-api-key|--api-key|--experimental_issuer|--experimental_client-id)
        exec "${REAL_CODEX_BIN}" login "$@"
        ;;
    esac
  done

  if ! check_device_code_preflight; then
    exit 1
  fi

  echo "Remote/mobile session detected. Using device-code login instead of localhost browser callback." >&2
  exec "${REAL_CODEX_BIN}" login --device-auth "$@"
fi

if is_remote_web_terminal && ! is_codex_subcommand "${1:-}" && ! has_explicit_model_arg "$@"; then
  exec "${REAL_CODEX_BIN}" -m gpt-5.4 "$@"
fi

exec "${REAL_CODEX_BIN}" "$@"
