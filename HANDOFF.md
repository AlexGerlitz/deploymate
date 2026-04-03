# DeployMate Handoff

Updated: 2026-04-03

## Current State

- Branch: `main`
- Working tree: dirty
- Latest commit: `b8b59d1` `Simplify deployment detail actions`
- `main`, `develop`, `origin/main`, and `origin/develop` are aligned
- Remote checkout on `deploymate` is on:
  - branch: `main`
  - commit: `b8b59d1c0a9c30c8ecd960a6acff22b13e003191`

## What Was Completed In The Latest Session

### Frontend product polish

- workspace and public surfaces were calmed and simplified:
  - [landing page](/Users/alexgerlitz/deploymate/frontend/app/page.js)
  - [workspace page](/Users/alexgerlitz/deploymate/frontend/app/app/page.js)
  - [global styles](/Users/alexgerlitz/deploymate/frontend/app/globals.css)
- deployment detail flow was simplified in:
  - [deployment detail page](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
- admin surfaces were simplified in:
  - [users page](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
  - [upgrade requests page](/Users/alexgerlitz/deploymate/frontend/app/app/upgrade-requests/page.js)
- mobile / compact viewport polish was added for:
  - `/`
  - `/login`
  - `/app`
  - `/deployments/[deploymentId]`
- frontend now surfaces clearer degraded / export error states in:
  - [workspace page](/Users/alexgerlitz/deploymate/frontend/app/app/page.js)
  - [users page](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
  - [admin page utils](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-page-utils.js)

Key UX direction now in place:

- one obvious next step on primary screens
- calmer premium visual layer
- progressive disclosure for secondary tools
- less button noise in runtime/detail flows

Latest frontend batch commits:

- `4e41e54` `Calm frontend surfaces and harden auth flows`
- `b8b59d1` `Simplify deployment detail actions`

### Backend auth and security hardening

- session TTL support added
- auth failed-attempt rate limiting added
- cookie max-age / expiry now follow session TTL
- stricter auth/admin credential validation added
- lightweight security headers middleware added
- authenticated write requests are now origin-guarded in:
  - [backend/app/main.py](/Users/alexgerlitz/deploymate/backend/app/main.py)

Latest backend/security batch commits:

- `c48eb24` `Guard authenticated writes by origin`
- `c6d91c6` `Harden backend observability and server exports`
- `fc7ad18` `Harden deployment observability fallbacks`

### Backend safety follow-up now implemented locally

- restore dry-run validation was tightened in:
  - [backend restore routes](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- ops overview now degrades more safely and ops exports return clearer `503` responses in:
  - [backend ops routes](/Users/alexgerlitz/deploymate/backend/app/routes/ops.py)
- backend negative-path coverage was extended in:
  - [restore dry-run tests](/Users/alexgerlitz/deploymate/backend/tests/test_restore_dry_run.py)
  - [ops api flow tests](/Users/alexgerlitz/deploymate/backend/tests/test_ops_api_flow.py)

### CI / staging automation now implemented locally

- `develop` push flow was changed so CI can auto-deploy the same reviewed commit to staging after the release gate passes
- deploy surface is now auto-detected as `frontend`, `backend`, `full`, or `skip` using:
  - [release surface detector](/Users/alexgerlitz/deploymate/scripts/detect_release_surface.sh)
- workflow wiring and operator docs were updated in:
  - [CI workflow](/Users/alexgerlitz/deploymate/.github/workflows/ci.yml)
  - [staging workflow](/Users/alexgerlitz/deploymate/.github/workflows/staging.yml)
  - [runbook](/Users/alexgerlitz/deploymate/RUNBOOK.md)

## What Was Verified

Frontend:

- `npm --prefix frontend run build` -> ok
- `FRONTEND_SMOKE_PORT=3002 npm --prefix frontend run smoke:auth` -> ok
- `FRONTEND_SMOKE_PORT=3003 npm --prefix frontend run smoke:ops` -> ok
- `FRONTEND_SMOKE_PORT=3004 npm --prefix frontend run smoke:runtime` -> ok
- `FRONTEND_SMOKE_PORT=3005 npm --prefix frontend run smoke:admin` -> ok

Backend:

- `venv/bin/python -m unittest tests.test_auth_api_flow tests.test_auth_security` -> ok
- `venv/bin/python -m unittest tests.test_admin_api_flow tests.test_ops_api_flow tests.test_restore_dry_run tests.test_server_credentials_policy` -> ok
- `bash scripts/security_audit.sh` -> ok

Automation:

- `bash -n scripts/detect_release_surface.sh` -> ok
- `bash scripts/detect_release_surface.sh HEAD~1 HEAD` -> ok

Production:

- full release for `4e41e54` -> passed
- backend-only release for `c48eb24` -> passed
- frontend-only release for `b8b59d1` -> passed
- post-deploy smoke -> passed

## Production Notes

- current production admin demo credentials were used during smoke:
  - username: `admin`
  - password currently exists on the server in `/opt/deploymate/.env.production`
- current server disk usage concern was raised manually; repo state is fine, but VPS capacity planning may be needed later if images, logs, and backups keep growing

## Important Resume Note About Sandbox

- this chat session remained in `workspace-write` sandbox mode
- starting a separate Codex process with `--dangerously-bypass-approvals-and-sandbox` does not retroactively change an already open session
- if resuming in a fresh unrestricted session, start a new Codex process and continue from this handoff

## Best Next Steps

Highest-value next slices:

1. Split and commit the current work in clean batches:
   - CI / staging automation
   - frontend product + mobile polish
   - backend safety follow-up
2. Push `develop` after the automation commit and confirm the new auto-staging path works end-to-end in GitHub Actions
3. After the first auto-staging run, document any missing staging secrets or timing issues directly in [RUNBOOK.md](/Users/alexgerlitz/deploymate/RUNBOOK.md) and this handoff

## If You Need To Resume Fast

1. Open [HANDOFF.md](/Users/alexgerlitz/deploymate/HANDOFF.md)
2. Confirm head:
   - `git rev-parse --short HEAD`
3. Confirm public branches:
   - `git log --oneline --decorate -n 6`
4. Confirm server checkout if deploying:
   - `ssh deploymate "cd /opt/deploymate && git rev-parse HEAD && git rev-parse --abbrev-ref HEAD"`
5. Re-run relevant checks for the next batch:
   - frontend batch: `npm --prefix frontend run build`
   - auth batch: `FRONTEND_SMOKE_PORT=3002 npm --prefix frontend run smoke:auth`
   - workspace batch: `FRONTEND_SMOKE_PORT=3003 npm --prefix frontend run smoke:ops`
   - runtime batch: `FRONTEND_SMOKE_PORT=3004 npm --prefix frontend run smoke:runtime`
   - admin batch: `FRONTEND_SMOKE_PORT=3005 npm --prefix frontend run smoke:admin`
   - backend safety batch: `cd backend && venv/bin/python -m unittest tests.test_restore_dry_run tests.test_admin_api_flow tests.test_ops_api_flow tests.test_auth_security tests.test_server_credentials_policy`
   - automation batch: `bash -n scripts/detect_release_surface.sh && bash scripts/detect_release_surface.sh HEAD~1 HEAD`
