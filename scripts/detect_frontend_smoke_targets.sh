#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -eq 0 ]; then
  cat <<'EOF'
auth
ops
runtime
EOF
  exit 0
fi

selected_targets=()

add_target() {
  selected_targets+=("$1")
}

for path in "$@"; do
  case "$path" in
    frontend/app/login/*|frontend/app/register/*|frontend/app/change-password/*|frontend/app/lib/auth-form-helpers.js)
      add_target auth
      ;;
    frontend/app/app/page.js|frontend/app/app/admin-ui.js|frontend/app/app/users/page.js|frontend/app/app/upgrade-requests/page.js|frontend/app/lib/admin-*.js|frontend/app/lib/admin-page-*.js)
      add_target ops
      ;;
    frontend/app/deployments/*|frontend/app/lib/smoke-fixtures.js)
      add_target runtime
      ;;
    frontend/app/page.js|frontend/app/layout.js|frontend/app/globals.css|frontend/app/commercial-license/page.js|frontend/app/upgrade/page.js|frontend/app/lib/public-contact.js)
      add_target auth
      add_target ops
      ;;
    frontend/app/lib/admin-smoke-fixtures.js)
      add_target ops
      ;;
    frontend/tests/*|frontend/package.json|frontend/package-lock.json|frontend/Dockerfile|frontend/next.config.mjs|frontend/middleware.js)
      add_target auth
      add_target ops
      add_target runtime
      ;;
    frontend/*)
      add_target auth
      add_target ops
      add_target runtime
      ;;
  esac
done

if [ "${#selected_targets[@]}" -eq 0 ]; then
  printf '%s\n' auth ops runtime
  exit 0
fi

printf '%s\n' "${selected_targets[@]}" | sort -u
