#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEPLOY_HOST="${DEPLOYMATE_DEPLOY_HOST:-}"
DEPLOY_REPO_DIR="${DEPLOYMATE_DEPLOY_REPO_DIR:-/opt/deploymate}"
DEPLOY_BRANCH="${DEPLOYMATE_DEPLOY_BRANCH:-develop}"
DEPLOY_REF="${DEPLOYMATE_DEPLOY_REF:-}"
DEPLOY_ENV_FILE="${DEPLOYMATE_DEPLOY_ENV_FILE:-.env.production}"
DEPLOY_SURFACE="${DEPLOYMATE_DEPLOY_SURFACE:-full}"
BASE_URL="${DEPLOYMATE_BASE_URL:-}"
ADMIN_USERNAME="${DEPLOYMATE_ADMIN_USERNAME:-}"
ADMIN_PASSWORD="${DEPLOYMATE_ADMIN_PASSWORD:-}"
SKIP_SMOKE="${DEPLOYMATE_SKIP_SMOKE:-0}"
SMOKE_RUNNER="${DEPLOYMATE_SMOKE_RUNNER:-local}"
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
  --ref <git-ref>             Exact Git ref or commit SHA to deploy after switching branch
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
  Set DEPLOYMATE_SMOKE_CURL_RESOLVE=host:443:ip when the smoke runner cannot
  resolve the public hostname directly.
  Before any remote build, the helper verifies that the provided admin smoke
  credentials still match the target runtime env file.
  Before any remote build, the helper runs a fast smoke-credentials precheck
  against the current target and aborts early on explicit 401/403 auth failures.
  Set DEPLOYMATE_SMOKE_RUNNER=remote to execute post-deploy smoke on the
  deploy host over SSH instead of from the local release runner.

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
    --ref)
      DEPLOY_REF="${2:-}"
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

case "$SMOKE_RUNNER" in
  local|remote)
    ;;
  *)
    echo "[remote-release] invalid smoke runner: $SMOKE_RUNNER" >&2
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
if [ -n "$DEPLOY_REF" ]; then
  echo "[remote-release] ref: $DEPLOY_REF"
fi
echo "[remote-release] remote repo: $DEPLOY_REPO_DIR"
echo "[remote-release] remote env file: $DEPLOY_ENV_FILE"
echo "[remote-release] smoke runner: $SMOKE_RUNNER"

if [ "$SKIP_SMOKE" != "1" ]; then
  echo "[remote-release] release secret contract"
  run_cmd bash scripts/release_secret_contract_audit.sh \
    --host "$DEPLOY_HOST" \
    --repo-dir "$DEPLOY_REPO_DIR" \
    --env-file "$DEPLOY_ENV_FILE" \
    --admin-username "$ADMIN_USERNAME" \
    --admin-password "$ADMIN_PASSWORD"

  echo "[remote-release] smoke credential precheck"
  run_cmd env \
    DEPLOYMATE_BASE_URL="$BASE_URL" \
    DEPLOYMATE_ADMIN_USERNAME="$ADMIN_USERNAME" \
    DEPLOYMATE_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    DEPLOYMATE_SMOKE_CURL_RESOLVE="${DEPLOYMATE_SMOKE_CURL_RESOLVE:-}" \
    bash scripts/release_smoke_precheck.sh
fi

quoted_env_file="$(printf '%q' "$DEPLOY_ENV_FILE")"

case "$DEPLOY_SURFACE" in
  frontend)
    REMOTE_COMPOSE_CMD="docker compose -f docker-compose.prod.yml --env-file $quoted_env_file up -d --build --no-deps frontend && docker compose -f docker-compose.prod.yml --env-file $quoted_env_file ps frontend"
    ;;
  backend)
    REMOTE_COMPOSE_CMD="docker compose -f docker-compose.prod.yml --env-file $quoted_env_file up -d --build --no-deps backend && docker compose -f docker-compose.prod.yml --env-file $quoted_env_file ps backend"
    ;;
  full)
    REMOTE_COMPOSE_CMD="docker compose -f docker-compose.prod.yml --env-file $quoted_env_file up -d --build && docker compose -f docker-compose.prod.yml --env-file $quoted_env_file ps"
    ;;
esac

REMOTE_AUDIT_CMD="bash scripts/runtime_capability_audit.sh --env-file $quoted_env_file && bash scripts/production_env_audit.sh --env-file $quoted_env_file --require-runtime-files"
REMOTE_SWITCH_CMD="git switch $DEPLOY_BRANCH || { echo [remote-release]\ regular\ branch\ switch\ failed,\ retrying\ with\ local\ changes\ preserved; git status --short; git switch --merge $DEPLOY_BRANCH; }"
REMOTE_RECOVER_CMD="git merge --abort >/dev/null 2>&1 || git reset --merge >/dev/null 2>&1 || true"

if [ "$DEPLOY_SURFACE" = "frontend" ]; then
  if [ -n "$DEPLOY_REF" ]; then
    REMOTE_TARGET_CMD="git fetch origin $DEPLOY_REF && TARGET_SHA=\$(git rev-parse FETCH_HEAD)"
  else
    REMOTE_TARGET_CMD="git fetch origin $DEPLOY_BRANCH && TARGET_SHA=\$(git rev-parse origin/$DEPLOY_BRANCH)"
  fi
  REMOTE_CMD="cd $DEPLOY_REPO_DIR && $REMOTE_RECOVER_CMD && $REMOTE_TARGET_CMD && RELEASE_WORKTREE=.release-worktrees/\$TARGET_SHA-\$\$ && mkdir -p .release-worktrees && git worktree add --detach \$RELEASE_WORKTREE \$TARGET_SHA && REMOTE_ENV_FILE=$DEPLOY_ENV_FILE && case \"\$REMOTE_ENV_FILE\" in /*) ;; *) REMOTE_ENV_FILE=$DEPLOY_REPO_DIR/\$REMOTE_ENV_FILE ;; esac && cd \$RELEASE_WORKTREE && bash scripts/runtime_capability_audit.sh --env-file \$REMOTE_ENV_FILE && bash scripts/production_env_audit.sh --env-file \$REMOTE_ENV_FILE --require-runtime-files && COMPOSE_PROJECT_NAME=deploymate docker compose -f docker-compose.prod.yml --env-file \$REMOTE_ENV_FILE up -d --build --no-deps frontend && COMPOSE_PROJECT_NAME=deploymate docker compose -f docker-compose.prod.yml --env-file \$REMOTE_ENV_FILE ps frontend && DEPLOYED_SHA=\$TARGET_SHA && echo [remote-release]\ deployed\ sha:\ \$DEPLOYED_SHA && cd $DEPLOY_REPO_DIR && (git worktree remove --force \$RELEASE_WORKTREE >/dev/null 2>&1 || true)"
elif [ -n "$DEPLOY_REF" ]; then
  REMOTE_CMD="cd $DEPLOY_REPO_DIR && git fetch origin $DEPLOY_BRANCH && $REMOTE_SWITCH_CMD && git merge --ff-only origin/$DEPLOY_BRANCH && git fetch origin $DEPLOY_REF && TARGET_SHA=\$(git rev-parse FETCH_HEAD) && git merge --ff-only \$TARGET_SHA && DEPLOYED_SHA=\$(git rev-parse HEAD) && echo [remote-release]\ deployed\ sha:\ \$DEPLOYED_SHA && if [ \"\$DEPLOYED_SHA\" != \"\$TARGET_SHA\" ]; then echo [remote-release]\ deployed\ sha\ mismatch >&2; exit 1; fi && $REMOTE_AUDIT_CMD && $REMOTE_COMPOSE_CMD"
else
  REMOTE_CMD="cd $DEPLOY_REPO_DIR && git fetch origin $DEPLOY_BRANCH && $REMOTE_SWITCH_CMD && git merge --ff-only origin/$DEPLOY_BRANCH && DEPLOYED_SHA=\$(git rev-parse HEAD) && echo [remote-release]\ deployed\ sha:\ \$DEPLOYED_SHA && $REMOTE_AUDIT_CMD && $REMOTE_COMPOSE_CMD"
fi

echo "[remote-release] remote deploy"
run_cmd ssh "$DEPLOY_HOST" "$REMOTE_CMD"

if [ "$SKIP_SMOKE" = "1" ]; then
  echo "[remote-release] smoke skipped by request"
  exit 0
fi

shell_quote() {
  printf '%q' "$1"
}

echo "[remote-release] post-deploy smoke"
if [ "$SMOKE_RUNNER" = "remote" ]; then
  REMOTE_SMOKE_CMD="cd $(shell_quote "$DEPLOY_REPO_DIR") && env \
DEPLOYMATE_BASE_URL=$(shell_quote "$BASE_URL") \
DEPLOYMATE_ADMIN_USERNAME=$(shell_quote "$ADMIN_USERNAME") \
DEPLOYMATE_ADMIN_PASSWORD=$(shell_quote "$ADMIN_PASSWORD") \
DEPLOYMATE_SMOKE_RUNTIME_ENABLED=$(shell_quote "${DEPLOYMATE_SMOKE_RUNTIME_ENABLED:-0}") \
DEPLOYMATE_SMOKE_SERVER_ID=$(shell_quote "${DEPLOYMATE_SMOKE_SERVER_ID:-}") \
DEPLOYMATE_SMOKE_SERVER_NAME=$(shell_quote "${DEPLOYMATE_SMOKE_SERVER_NAME:-}") \
DEPLOYMATE_SMOKE_SERVER_HOST=$(shell_quote "${DEPLOYMATE_SMOKE_SERVER_HOST:-}") \
DEPLOYMATE_SMOKE_SERVER_PORT=$(shell_quote "${DEPLOYMATE_SMOKE_SERVER_PORT:-}") \
DEPLOYMATE_SMOKE_SERVER_USERNAME=$(shell_quote "${DEPLOYMATE_SMOKE_SERVER_USERNAME:-}") \
DEPLOYMATE_SMOKE_SSH_KEY_FILE=$(shell_quote "${DEPLOYMATE_SMOKE_SSH_KEY_FILE:-}") \
DEPLOYMATE_SMOKE_IMAGE=$(shell_quote "${DEPLOYMATE_SMOKE_IMAGE:-}") \
DEPLOYMATE_SMOKE_INTERNAL_PORT=$(shell_quote "${DEPLOYMATE_SMOKE_INTERNAL_PORT:-}") \
DEPLOYMATE_SMOKE_EXTERNAL_PORT=$(shell_quote "${DEPLOYMATE_SMOKE_EXTERNAL_PORT:-}") \
DEPLOYMATE_SMOKE_START_PORT=$(shell_quote "${DEPLOYMATE_SMOKE_START_PORT:-}") \
DEPLOYMATE_SMOKE_HEALTH_TIMEOUT=$(shell_quote "${DEPLOYMATE_SMOKE_HEALTH_TIMEOUT:-}") \
DEPLOYMATE_SMOKE_CURL_RESOLVE=$(shell_quote "${DEPLOYMATE_SMOKE_CURL_RESOLVE:-}") \
bash scripts/post_deploy_smoke.sh"
  run_cmd ssh "$DEPLOY_HOST" "$REMOTE_SMOKE_CMD"
else
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
    DEPLOYMATE_SMOKE_CURL_RESOLVE="${DEPLOYMATE_SMOKE_CURL_RESOLVE:-}" \
    bash scripts/post_deploy_smoke.sh
fi

echo "[remote-release] deploy and smoke passed"
