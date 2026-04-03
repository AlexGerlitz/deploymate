#!/usr/bin/env bash

set -euo pipefail

AUTOMATION_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTOMATION_REPO_ROOT="$(cd "${AUTOMATION_SCRIPT_DIR}/.." && pwd)"
source "${AUTOMATION_SCRIPT_DIR}/project_automation_config.sh"

automation_repo_root() {
  printf '%s\n' "$AUTOMATION_REPO_ROOT"
}

automation_frontend_dir_rel() {
  printf '%s\n' "$AUTOMATION_FRONTEND_DIR_REL"
}

automation_frontend_dir() {
  printf '%s/%s\n' "$AUTOMATION_REPO_ROOT" "$AUTOMATION_FRONTEND_DIR_REL"
}

automation_backend_dir_rel() {
  printf '%s\n' "$AUTOMATION_BACKEND_DIR_REL"
}

automation_backend_dir() {
  printf '%s/%s\n' "$AUTOMATION_REPO_ROOT" "$AUTOMATION_BACKEND_DIR_REL"
}

automation_backend_app_dir_rel() {
  printf '%s\n' "$AUTOMATION_BACKEND_APP_DIR_REL"
}

automation_backend_app_dir() {
  printf '%s/%s\n' "$AUTOMATION_REPO_ROOT" "$AUTOMATION_BACKEND_APP_DIR_REL"
}

automation_backend_tests_dir_rel() {
  printf '%s\n' "$AUTOMATION_BACKEND_TEST_DIR_REL"
}

automation_backend_tests_dir() {
  printf '%s/%s\n' "$AUTOMATION_REPO_ROOT" "$AUTOMATION_BACKEND_TEST_DIR_REL"
}

automation_frontend_ready_path() {
  printf '%s\n' "$AUTOMATION_FRONTEND_READY_PATH"
}

automation_frontend_auth_ready_path() {
  printf '%s\n' "$AUTOMATION_FRONTEND_AUTH_READY_PATH"
}

automation_frontend_users_ready_path() {
  printf '%s\n' "$AUTOMATION_FRONTEND_USERS_READY_PATH"
}

automation_frontend_runtime_detail_path() {
  printf '%s\n' "$AUTOMATION_FRONTEND_RUNTIME_DETAIL_PATH"
}

automation_frontend_fast_smokes_default() {
  printf '%s\n' "$AUTOMATION_FRONTEND_FAST_SMOKES_DEFAULT"
}

automation_frontend_smoke_registry_dir() {
  printf '%s\n' "$AUTOMATION_FRONTEND_SMOKE_REGISTRY_DIR"
}

automation_backend_python() {
  if [ -n "${BACKEND_PYTHON:-}" ]; then
    printf '%s\n' "$BACKEND_PYTHON"
    return 0
  fi

  if [ -x "$AUTOMATION_REPO_ROOT/$AUTOMATION_BACKEND_VENV_PYTHON_REL" ]; then
    printf '%s\n' "$AUTOMATION_BACKEND_VENV_PYTHON_REL"
    return 0
  fi

  printf 'python3\n'
}

automation_frontend_npm() {
  npm --prefix "$AUTOMATION_FRONTEND_DIR_REL" "$@"
}
