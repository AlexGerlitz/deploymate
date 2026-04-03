#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -eq 0 ]; then
  cat <<'EOF'
backend.tests.test_auth_security
backend.tests.test_ops_api_flow
backend.tests.test_restore_dry_run
backend.tests.test_server_credentials_policy
EOF
  exit 0
fi

selected_tests=()

add_test() {
  selected_tests+=("$1")
}

for path in "$@"; do
  case "$path" in
    backend/tests/test_*.py)
      module="${path%.py}"
      module="${module//\//.}"
      add_test "$module"
      ;;
    backend/app/routes/auth.py|backend/app/services/auth.py)
      add_test backend.tests.test_auth_api_flow
      add_test backend.tests.test_auth_security
      ;;
    backend/app/routes/ops.py|backend/app/routes/notifications.py)
      add_test backend.tests.test_ops_api_flow
      ;;
    backend/app/routes/root.py)
      add_test backend.tests.test_restore_dry_run
      add_test backend.tests.test_admin_api_flow
      ;;
    backend/app/routes/deployments.py|backend/app/routes/deployment_observability.py|backend/app/services/deployments.py|backend/app/services/deployment_mutations.py|backend/app/services/deployment_observability.py|backend/app/services/runtime_executors.py)
      add_test backend.tests.test_deployment_api_flow
      add_test backend.tests.test_deployment_routes
      add_test backend.tests.test_deployment_ssh_options
      add_test backend.tests.test_local_runtime_policy
      ;;
    backend/app/routes/deployment_templates.py|backend/app/services/deployment_templates.py)
      add_test backend.tests.test_template_api_flow
      ;;
    backend/app/routes/servers.py|backend/app/services/server_credentials.py|backend/app/services/server_diagnostics.py)
      add_test backend.tests.test_server_api_flow
      add_test backend.tests.test_server_credentials
      add_test backend.tests.test_server_credentials_policy
      ;;
    backend/app/db.py|backend/app/main.py|backend/app/schemas.py)
      add_test backend.tests.test_admin_api_flow
      add_test backend.tests.test_auth_api_flow
      add_test backend.tests.test_auth_security
      add_test backend.tests.test_deployment_api_flow
      add_test backend.tests.test_deployment_routes
      add_test backend.tests.test_local_runtime_policy
      add_test backend.tests.test_ops_api_flow
      add_test backend.tests.test_restore_dry_run
      add_test backend.tests.test_server_api_flow
      add_test backend.tests.test_server_credentials
      add_test backend.tests.test_server_credentials_policy
      add_test backend.tests.test_template_api_flow
      ;;
    backend/app/__init__.py|backend/app/routes/__init__.py)
      ;;
    *)
      add_test backend.tests.test_auth_security
      add_test backend.tests.test_ops_api_flow
      add_test backend.tests.test_restore_dry_run
      add_test backend.tests.test_server_credentials_policy
      ;;
  esac
done

printf '%s\n' "${selected_tests[@]}" | sort -u
