#!/usr/bin/env bash

# Project-specific detection rules for the reusable automation core.

automation_frontend_fast_smokes_default_lines() {
  cat <<'EOF'
auth
ops
runtime
EOF
}

automation_backend_fast_safety_tests_lines() {
  cat <<'EOF'
backend.tests.test_auth_security
backend.tests.test_ops_api_flow
backend.tests.test_production_env_audit
backend.tests.test_restore_dry_run
backend.tests.test_server_credentials_policy
EOF
}

automation_classify_release_path() {
  local path="$1"
  case "$path" in
    frontend/*)
      printf 'frontend\n'
      ;;
    backend/*)
      printf 'backend\n'
      ;;
    README.md|RUNBOOK.md|HANDOFF.md|LICENSE|.gitignore|.github/*)
      printf 'docs\n'
      ;;
    *)
      printf 'shared\n'
      ;;
  esac
}

automation_frontend_smoke_targets_for_path() {
  local path="$1"
  case "$path" in
    frontend/app/login/*|frontend/app/register/*|frontend/app/change-password/*|frontend/app/lib/auth-form-helpers.js)
      printf '%s\n' auth
      ;;
    frontend/app/app/page.js|frontend/app/app/admin-ui.js|frontend/app/app/users/page.js|frontend/app/app/upgrade-requests/page.js|frontend/app/lib/admin-*.js|frontend/app/lib/admin-page-*.js|frontend/app/lib/admin-smoke-fixtures.js)
      printf '%s\n' ops
      ;;
    frontend/app/deployments/*|frontend/app/lib/smoke-fixtures.js)
      printf '%s\n' runtime
      ;;
    frontend/app/page.js|frontend/app/layout.js|frontend/app/globals.css|frontend/app/commercial-license/page.js|frontend/app/upgrade/page.js|frontend/app/lib/public-contact.js)
      printf '%s\n' auth
      printf '%s\n' ops
      ;;
    frontend/tests/*|frontend/package.json|frontend/package-lock.json|frontend/Dockerfile|frontend/next.config.mjs|frontend/middleware.js|frontend/*)
      automation_frontend_fast_smokes_default_lines
      ;;
  esac
}

automation_backend_test_targets_for_path() {
  local path="$1"
  local module=""
  case "$path" in
    backend/tests/test_*.py)
      module="${path%.py}"
      module="${module//\//.}"
      printf '%s\n' "$module"
      ;;
    backend/app/routes/auth.py|backend/app/services/auth.py)
      printf '%s\n' backend.tests.test_auth_api_flow
      printf '%s\n' backend.tests.test_auth_security
      ;;
    backend/app/routes/ops.py|backend/app/routes/notifications.py)
      printf '%s\n' backend.tests.test_ops_api_flow
      ;;
    backend/app/routes/root.py)
      printf '%s\n' backend.tests.test_restore_dry_run
      printf '%s\n' backend.tests.test_admin_api_flow
      ;;
    backend/app/routes/deployments.py|backend/app/routes/deployment_observability.py|backend/app/services/deployments.py|backend/app/services/deployment_mutations.py|backend/app/services/deployment_observability.py|backend/app/services/runtime_executors.py)
      printf '%s\n' backend.tests.test_deployment_api_flow
      printf '%s\n' backend.tests.test_deployment_routes
      printf '%s\n' backend.tests.test_deployment_ssh_options
      printf '%s\n' backend.tests.test_local_runtime_policy
      ;;
    backend/app/routes/deployment_templates.py|backend/app/services/deployment_templates.py)
      printf '%s\n' backend.tests.test_template_api_flow
      ;;
    backend/app/routes/servers.py|backend/app/services/server_credentials.py|backend/app/services/server_diagnostics.py)
      printf '%s\n' backend.tests.test_server_api_flow
      printf '%s\n' backend.tests.test_server_credentials
      printf '%s\n' backend.tests.test_server_credentials_policy
      ;;
    docker-compose.prod.yml|.env.production.example|scripts/runtime_capability_audit.sh|scripts/production_env_audit.sh|scripts/preflight.sh|scripts/remote_release.sh)
      printf '%s\n' backend.tests.test_auth_security
      printf '%s\n' backend.tests.test_deployment_ssh_options
      printf '%s\n' backend.tests.test_production_env_audit
      ;;
    backend/app/db.py|backend/app/main.py|backend/app/schemas.py)
      cat <<'EOF'
backend.tests.test_admin_api_flow
backend.tests.test_auth_api_flow
backend.tests.test_auth_security
backend.tests.test_deployment_api_flow
backend.tests.test_deployment_routes
backend.tests.test_local_runtime_policy
backend.tests.test_ops_api_flow
backend.tests.test_production_env_audit
backend.tests.test_restore_dry_run
backend.tests.test_server_api_flow
backend.tests.test_server_credentials
backend.tests.test_server_credentials_policy
backend.tests.test_template_api_flow
EOF
      ;;
    backend/app/__init__.py|backend/app/routes/__init__.py)
      ;;
    *)
      automation_backend_fast_safety_tests_lines
      ;;
  esac
}

automation_frontend_fast_scope_for_path() {
  local path="$1"
  case "$path" in
    frontend/*)
      printf 'frontend\n'
      ;;
    frontend/Dockerfile|docker-compose.yml|docker-compose.prod.yml|deploy/*|infra/*|scripts/release_workflow.sh|scripts/preflight.sh|scripts/remote_release.sh|scripts/post_deploy_smoke.sh|scripts/production_env_audit.sh|scripts/production_contract_gate.sh)
      printf 'frontend_delivery_contract\n'
      ;;
    .github/*|README.md|RUNBOOK.md|HANDOFF.md|LICENSE|NOTICE|COMMERCIAL-LICENSE.md|docs/*|backend/*)
      printf 'ignore\n'
      ;;
    *)
      printf 'shared\n'
      ;;
  esac
}

automation_backend_fast_scope_for_path() {
  local path="$1"
  case "$path" in
    backend/*)
      printf 'backend\n'
      ;;
    docker-compose.yml|docker-compose.prod.yml|.env.production.example|frontend/Dockerfile|deploy/*|infra/*|scripts/runtime_capability_audit.sh|scripts/production_env_audit.sh|scripts/production_contract_gate.sh|scripts/local_runtime_audit.sh|scripts/security_audit.sh|scripts/preflight.sh|scripts/release_workflow.sh|scripts/remote_release.sh|scripts/post_deploy_smoke.sh)
      printf 'backend_release_contract\n'
      ;;
    .github/*|README.md|RUNBOOK.md|HANDOFF.md|LICENSE|NOTICE|COMMERCIAL-LICENSE.md|docs/*|frontend/*)
      printf 'ignore\n'
      ;;
    *)
      printf 'shared\n'
      ;;
  esac
}

automation_runtime_audit_scope_for_path() {
  local path="$1"
  case "$path" in
    docker-compose.yml|docker-compose.prod.yml|.env.production.example|frontend/Dockerfile|deploy/*|infra/*|backend/app/services/runtime_executors.py|scripts/runtime_capability_audit.sh|scripts/production_env_audit.sh|scripts/production_contract_gate.sh|scripts/local_runtime_audit.sh|scripts/security_audit.sh|scripts/preflight.sh|scripts/release_workflow.sh|scripts/remote_release.sh)
      printf 'runtime_contract\n'
      ;;
    *)
      printf 'ignore\n'
      ;;
  esac
}

automation_backend_syntax_scope_for_path() {
  local path="$1"
  case "$path" in
    backend/app/*.py|backend/app/**/*.py)
      printf 'backend_python\n'
      ;;
    backend/tests/*.py|backend/tests/**/*.py)
      printf 'backend_tests\n'
      ;;
    backend/*)
      printf 'backend_non_python\n'
      ;;
    docker-compose.yml|docker-compose.prod.yml|.env.production.example|deploy/*|infra/*|scripts/preflight.sh|scripts/release_workflow.sh|scripts/dev_verify_changed.sh|scripts/production_env_audit.sh|scripts/production_contract_gate.sh)
      printf 'backend_release_contract\n'
      ;;
    *)
      printf 'ignore\n'
      ;;
  esac
}

automation_security_scope_for_path() {
  local path="$1"
  case "$path" in
    .github/*|RUNBOOK.md|SAFE-RELEASE.md|scripts/release_workflow.sh|scripts/release_workflow_audit.sh|scripts/remote_release.sh|scripts/preflight.sh|scripts/security_audit.sh|scripts/production_contract_gate.sh|scripts/dev_fast_check.sh|scripts/dev_verify_changed.sh|scripts/derive_local_fast_context.sh)
      printf 'release_workflow_contract\n'
      ;;
    backend/app/db.py|backend/app/routes/servers.py|backend/app/routes/ops.py|backend/app/services/server_credentials.py|backend/app/services/runtime_executors.py|backend/tests/test_server_credentials.py|backend/tests/test_server_credentials_policy.py|scripts/server_credentials_audit.sh)
      printf 'server_credentials_contract\n'
      ;;
    docker-compose.yml|docker-compose.prod.yml|.env.production.example|frontend/Dockerfile|deploy/*|infra/*|scripts/runtime_capability_audit.sh|scripts/production_env_audit.sh|scripts/production_contract_gate.sh|scripts/local_runtime_audit.sh|scripts/post_deploy_smoke.sh)
      printf 'runtime_or_deploy_contract\n'
      ;;
    backend/app/services/runtime_executors.py|backend/app/routes/deployments.py|backend/app/routes/servers.py|backend/app/routes/ops.py|backend/tests/test_deployment_ssh_options.py)
      printf 'runtime_policy_file\n'
      ;;
    *)
      printf 'ignore\n'
      ;;
  esac
}
