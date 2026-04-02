#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEPLOY_HOST="${DEPLOYMATE_DEPLOY_HOST:-}"
DEPLOY_REPO_DIR="${DEPLOYMATE_DEPLOY_REPO_DIR:-/opt/deploymate}"
DEPLOY_BRANCH="${DEPLOYMATE_DEPLOY_BRANCH:-develop}"
DEPLOY_ENV_FILE="${DEPLOYMATE_DEPLOY_ENV_FILE:-.env.production}"
DEPLOY_SURFACE="${DEPLOYMATE_DEPLOY_SURFACE:-full}"
BASE_URL="${DEPLOYMATE_BASE_URL:-}"
ADMIN_USERNAME="${DEPLOYMATE_ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${DEPLOYMATE_ADMIN_PASSWORD:-}"
SKIP_SMOKE="${DEPLOYMATE_SKIP_SMOKE:-0}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage:
  bash scripts/remote_release.sh --host <ssh-host> --base-url <url> --admin-username <user> --admin-password <password> [options]

Options:
  --host <ssh-host>           SSH host alias or reachable host for the deploy target
  --surface <frontend|backend|full>
                              Release surface to rebuild on the remote host. Default: full
  --repo-dir <path>           Remote checkout path. Default: /opt/deploymate
  --branch <name>             Git branch to deploy. Default: develop
  --env-file <path>           Compose env file on the remote host. Default: .env.production
  --base-url <url>            Base URL for post-deploy smoke
  --admin-username <user>     Admin username for post-deploy smoke
  --admin-password <password> Admin password for post-deploy smoke
  --skip-smoke                Skip local post-deploy smoke after remote deploy
  --dry-run                   Print commands instead of executing them
  -h, --help                  Show this help

Environment passthrough:
  Any DEPLOYMATE_SMOKE_* variables already set in the shell are forwarded to
  scripts/post_deploy_smoke.sh. Use that for optional runtime smoke inputs.

Examples:
  bash scripts/remote_release.sh \
    --host deploymate \
    --surface frontend \
    --base-url https://deploymatecloud.ru \
    --admin-username admin \
    --admin-password '<secret>'

  DEPLOYMATE_SMOKE_RUNTIME_ENABLED=1 \
  DEPLOYMATE_SMOKE_SERVER_HOST=203.0.113.10 \
  DEPLOYMATE_SMOKE_SERVER_USERNAME=root \
  DEPLOYMATE_SMOKE_SSH_KEY_FILE="$HOME/.ssh/id_ed25519" \
  bash scripts/remote_release.sh \
    --host deploymate \
    --surface full \
    --base-url https://deploymatecloud.ru \
    --admin-username admin \
    --admin-password '<secret>'
EOF
}

require_value() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    echo "[remote-release] missing required value: $name" >&2
    exit 1
  fi
}

run_cmd() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '[remote-release] dry-run:'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi

  "$@"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --host)
      DEPLOY_HOST="${2:-}"
      shift 2
      ;;
    --surface)
      DEPLOY_SURFACE="${2:-}"
      shift 2
      ;;
    --repo-dir)
      DEPLOY_REPO_DIR="${2:-}"
      shift 2
      ;;
    --branch)
      DEPLOY_BRANCH="${2:-}"
      shift 2
      ;;
    --env-file)
      DEPLOY_ENV_FILE="${2:-}"
      shift 2
      ;;
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --admin-username)
      ADMIN_USERNAME="${2:-}"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="${2:-}"
      shift 2
      ;;
    --skip-smoke)
      SKIP_SMOKE="1"
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[remote-release] unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$DEPLOY_SURFACE" in
  frontend|backend|full)
    ;;
  *)
    echo "[remote-release] invalid surface: $DEPLOY_SURFACE" >&2
    usage >&2
    exit 1
    ;;
esac

require_value "--host" "$DEPLOY_HOST"
require_value "--base-url" "$BASE_URL"

if [ "$SKIP_SMOKE" != "1" ]; then
  require_value "--admin-username" "$ADMIN_USERNAME"
  require_value "--admin-password" "$ADMIN_PASSWORD"
fi

cd "$ROOT_DIR"

echo "[remote-release] repo: $ROOT_DIR"
echo "[remote-release] host: $DEPLOY_HOST"
echo "[remote-release] surface: $DEPLOY_SURFACE"
echo "[remote-release] branch: $DEPLOY_BRANCH"
echo "[remote-release] remote repo: $DEPLOY_REPO_DIR"
echo "[remote-release] remote env file: $DEPLOY_ENV_FILE"

case "$DEPLOY_SURFACE" in
  frontend)
    REMOTE_COMPOSE_CMD="docker compose -f docker-compose.prod.yml --env-file $DEPLOY_ENV_FILE up -d --build --no-deps frontend && docker compose -f docker-compose.prod.yml --env-file $DEPLOY_ENV_FILE ps frontend"
    ;;
  backend)
    REMOTE_COMPOSE_CMD="docker compose -f docker-compose.prod.yml --env-file $DEPLOY_ENV_FILE up -d --build --no-deps backend && docker compose -f docker-compose.prod.yml --env-file $DEPLOY_ENV_FILE ps backend"
    ;;
  full)
    REMOTE_COMPOSE_CMD="docker compose -f docker-compose.prod.yml --env-file $DEPLOY_ENV_FILE up -d --build && docker compose -f docker-compose.prod.yml --env-file $DEPLOY_ENV_FILE ps"
    ;;
esac

REMOTE_CMD="cd $DEPLOY_REPO_DIR && git fetch origin && git switch $DEPLOY_BRANCH && git pull --ff-only origin $DEPLOY_BRANCH && $REMOTE_COMPOSE_CMD"

echo "[remote-release] remote deploy"
run_cmd ssh "$DEPLOY_HOST" "$REMOTE_CMD"

if [ "$SKIP_SMOKE" = "1" ]; then
  echo "[remote-release] smoke skipped by request"
  exit 0
fi

echo "[remote-release] post-deploy smoke"
run_cmd env \
  DEPLOYMATE_BASE_URL="$BASE_URL" \
  DEPLOYMATE_ADMIN_USERNAME="$ADMIN_USERNAME" \
  DEPLOYMATE_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  DEPLOYMATE_SMOKE_RUNTIME_ENABLED="${DEPLOYMATE_SMOKE_RUNTIME_ENABLED:-0}" \
  DEPLOYMATE_SMOKE_SERVER_ID="${DEPLOYMATE_SMOKE_SERVER_ID:-}" \
  DEPLOYMATE_SMOKE_SERVER_NAME="${DEPLOYMATE_SMOKE_SERVER_NAME:-}" \
  DEPLOYMATE_SMOKE_SERVER_HOST="${DEPLOYMATE_SMOKE_SERVER_HOST:-}" \
  DEPLOYMATE_SMOKE_SERVER_PORT="${DEPLOYMATE_SMOKE_SERVER_PORT:-}" \
  DEPLOYMATE_SMOKE_SERVER_USERNAME="${DEPLOYMATE_SMOKE_SERVER_USERNAME:-}" \
  DEPLOYMATE_SMOKE_SSH_KEY_FILE="${DEPLOYMATE_SMOKE_SSH_KEY_FILE:-}" \
  DEPLOYMATE_SMOKE_IMAGE="${DEPLOYMATE_SMOKE_IMAGE:-}" \
  DEPLOYMATE_SMOKE_INTERNAL_PORT="${DEPLOYMATE_SMOKE_INTERNAL_PORT:-}" \
  DEPLOYMATE_SMOKE_EXTERNAL_PORT="${DEPLOYMATE_SMOKE_EXTERNAL_PORT:-}" \
  DEPLOYMATE_SMOKE_START_PORT="${DEPLOYMATE_SMOKE_START_PORT:-}" \
  DEPLOYMATE_SMOKE_HEALTH_TIMEOUT="${DEPLOYMATE_SMOKE_HEALTH_TIMEOUT:-}" \
  bash scripts/post_deploy_smoke.sh

echo "[remote-release] deploy and smoke passed"
