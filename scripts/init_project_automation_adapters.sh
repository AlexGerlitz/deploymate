#!/usr/bin/env bash

set -euo pipefail

TARGET_DIR=""
PROJECT_NAME="${PROJECT_NAME:-New Project}"
FRONTEND_DIR="${FRONTEND_DIR:-frontend}"
BACKEND_DIR="${BACKEND_DIR:-backend}"
BACKEND_APP_DIR="${BACKEND_APP_DIR:-$BACKEND_DIR/app}"
BACKEND_TEST_DIR="${BACKEND_TEST_DIR:-$BACKEND_DIR/tests}"
BACKEND_VENV_PYTHON="${BACKEND_VENV_PYTHON:-$BACKEND_DIR/venv/bin/python}"
FRONTEND_READY_PATH="${FRONTEND_READY_PATH:-/app}"
FRONTEND_AUTH_READY_PATH="${FRONTEND_AUTH_READY_PATH:-/login}"
FRONTEND_USERS_READY_PATH="${FRONTEND_USERS_READY_PATH:-/app/users}"
FRONTEND_RUNTIME_DETAIL_PATH="${FRONTEND_RUNTIME_DETAIL_PATH:-/deployments/smoke-deployment}"
SMOKE_REGISTRY_DIR="${SMOKE_REGISTRY_DIR:-/tmp/project-frontend-smoke-registry}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/init_project_automation_adapters.sh /absolute/path/to/project [options]

Options:
  --project-name <name>
  --frontend-dir <dir>
  --backend-dir <dir>
  --backend-app-dir <dir>
  --backend-test-dir <dir>
  --backend-venv-python <path>
  --frontend-ready-path <path>
  --frontend-auth-ready-path <path>
  --frontend-users-ready-path <path>
  --frontend-runtime-detail-path <path>
  --smoke-registry-dir <path>

Behavior:
  - updates the copied adapter files with the new project defaults
  - leaves the reusable core files untouched
EOF
}

replace_assignment() {
  local file_path="$1"
  local var_name="$2"
  local new_value="$3"
  ruby -e '
    file, key, value = ARGV
    content = File.read(file)
    pattern = /^#{Regexp.escape(key)}="[^"]*"$/
    replacement = "#{key}=\"#{value}\""
    updated = content.gsub(pattern, replacement)
    File.write(file, updated)
  ' "$file_path" "$var_name" "$new_value"
}

if [ "$#" -lt 1 ]; then
  usage >&2
  exit 1
fi

while [ "$#" -gt 0 ]; do
  case "$1" in
    --project-name)
      PROJECT_NAME="${2:-}"
      shift 2
      ;;
    --frontend-dir)
      FRONTEND_DIR="${2:-}"
      shift 2
      ;;
    --backend-dir)
      BACKEND_DIR="${2:-}"
      shift 2
      ;;
    --backend-app-dir)
      BACKEND_APP_DIR="${2:-}"
      shift 2
      ;;
    --backend-test-dir)
      BACKEND_TEST_DIR="${2:-}"
      shift 2
      ;;
    --backend-venv-python)
      BACKEND_VENV_PYTHON="${2:-}"
      shift 2
      ;;
    --frontend-ready-path)
      FRONTEND_READY_PATH="${2:-}"
      shift 2
      ;;
    --frontend-auth-ready-path)
      FRONTEND_AUTH_READY_PATH="${2:-}"
      shift 2
      ;;
    --frontend-users-ready-path)
      FRONTEND_USERS_READY_PATH="${2:-}"
      shift 2
      ;;
    --frontend-runtime-detail-path)
      FRONTEND_RUNTIME_DETAIL_PATH="${2:-}"
      shift 2
      ;;
    --smoke-registry-dir)
      SMOKE_REGISTRY_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$TARGET_DIR" ]; then
        echo "[init-project-automation-adapters] unexpected extra argument: $1" >&2
        exit 1
      fi
      TARGET_DIR="$1"
      shift
      ;;
  esac
done

if [ -z "$TARGET_DIR" ] || [ ! -d "$TARGET_DIR" ]; then
  echo "[init-project-automation-adapters] target directory does not exist: ${TARGET_DIR:-missing}" >&2
  exit 1
fi

config_file="$TARGET_DIR/scripts/project_automation_config.sh"
targets_file="$TARGET_DIR/scripts/project_automation_targets.sh"
smokes_file="$TARGET_DIR/scripts/project_automation_smoke_checks.sh"

for path in "$config_file" "$targets_file" "$smokes_file"; do
  if [ ! -f "$path" ]; then
    echo "[init-project-automation-adapters] missing adapter file: $path" >&2
    exit 1
  fi
done

replace_assignment "$config_file" "AUTOMATION_FRONTEND_DIR_REL" "$FRONTEND_DIR"
replace_assignment "$config_file" "AUTOMATION_BACKEND_DIR_REL" "$BACKEND_DIR"
replace_assignment "$config_file" "AUTOMATION_BACKEND_APP_DIR_REL" "$BACKEND_APP_DIR"
replace_assignment "$config_file" "AUTOMATION_BACKEND_TEST_DIR_REL" "$BACKEND_TEST_DIR"
replace_assignment "$config_file" "AUTOMATION_BACKEND_VENV_PYTHON_REL" "$BACKEND_VENV_PYTHON"
replace_assignment "$config_file" "AUTOMATION_FRONTEND_READY_PATH" "$FRONTEND_READY_PATH"
replace_assignment "$config_file" "AUTOMATION_FRONTEND_AUTH_READY_PATH" "$FRONTEND_AUTH_READY_PATH"
replace_assignment "$config_file" "AUTOMATION_FRONTEND_USERS_READY_PATH" "$FRONTEND_USERS_READY_PATH"
replace_assignment "$config_file" "AUTOMATION_FRONTEND_RUNTIME_DETAIL_PATH" "$FRONTEND_RUNTIME_DETAIL_PATH"
replace_assignment "$config_file" "AUTOMATION_FRONTEND_SMOKE_REGISTRY_DIR" "$SMOKE_REGISTRY_DIR"

if ! grep -q "Project-specific adapter for the reusable local automation core." "$config_file"; then
  echo "[init-project-automation-adapters] unexpected config format: $config_file" >&2
  exit 1
fi

cat <<EOF
[init-project-automation-adapters] project: $PROJECT_NAME
[init-project-automation-adapters] updated:
  - scripts/project_automation_config.sh
[init-project-automation-adapters] next edits still required:
  - scripts/project_automation_targets.sh
  - scripts/project_automation_smoke_checks.sh
[init-project-automation-adapters] recommended first validation:
  - make changed
  - make profile-changed
  - make dev-doctor
EOF
