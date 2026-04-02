# Changelog

## Unreleased

Highlights:

- added backend route tests for deployment redeploy, delete, and diagnostics behavior
- added an HTTP-level deployment API flow test for create -> health/logs/diagnostics/activity -> delete
- added an HTTP-level server API flow test for create -> test -> diagnostics -> suggested ports -> delete
- added an HTTP-level admin API flow test for users, upgrade requests, exports, backup bundle, restore dry-run, and audit history
- added an HTTP-level deployment template API flow test for create, filter, update, duplicate, deploy, and delete
- added an HTTP-level ops API flow test for overview and deployments/servers/templates/activity exports
- added an HTTP-level auth API flow test for register, me, change-password, logout, and login
- added dedicated frontend auth smoke coverage for login, register, and change-password pages
- added dedicated frontend admin-interactions smoke coverage for saved views and bulk-action surfaces on admin pages
- improved restore dry-run reporting with digest copy, issues CSV export, and attention overview cards
- added dedicated frontend restore-report smoke coverage for backup / restore validation workflows
- improved deployment detail ergonomics with quick overview cards, attention surface, and copyable runtime summary
- enforced fail-fast startup when server credential records exist without `DEPLOYMATE_SERVER_CREDENTIALS_KEY`
- added `scripts/server_credentials_audit.sh` and wired server credential checks into `scripts/security_audit.sh`
- made backend local Docker execution explicit opt-in by default and added local runtime boundary audit coverage
- added runtime capability posture to ops overview so the UI reflects backend local-Docker, SSH trust, and credential-key state
- added runtime capability contract audit and aligned production frontend local-runtime default with remote-only backend policy
- wired the runtime capability audit into the main security audit so release gates fail on frontend/backend capability drift
- split runtime execution into dedicated local and remote executor layers so SSH transport and local Docker policy no longer live in one deployment service module
- moved server diagnostics and connection probing into a dedicated service layer instead of keeping ops-oriented SSH health logic inside deployment runtime orchestration
- moved deployment health/logs/diagnostics assembly into a dedicated observability service so runtime inspection is separated from deployment mutation flows
- moved deployment create/redeploy/delete mutation workflows into a dedicated service so deployment routes are now thin HTTP adapters over orchestration logic
- moved deployment template list/create/update/duplicate/deploy/delete workflow into a dedicated service so routes no longer own template orchestration either
- split the deployment HTTP layer into dedicated router modules for deployments, deployment templates, and deployment observability
- moved shared frontend runtime smoke fixtures into a dedicated lib module so `/app` and `/deployments/[deploymentId]` no longer duplicate smoke data inline
- added dedicated frontend runtime smoke coverage for `/app` and `/deployments/[deploymentId]`
- added dedicated frontend ops smoke coverage for the operations overview and export action surface
- added dedicated frontend servers smoke coverage for the server-management and diagnostics surface
- added dedicated frontend templates smoke coverage for the templates panel and create-form template controls
- extended the local release gate to run auth, admin, admin-interactions, ops, restore, runtime, servers, and templates frontend smokes before build
- extended post-deploy smoke with optional create -> health -> diagnostics -> logs -> activity -> delete runtime flow
- added a single local release workflow script for preflight, frontend smokes, build, and backend tests
- added a single remote release helper to sync, rebuild, and run post-deploy smoke in one command
- added GitHub Actions CI to run the release workflow on `develop` pushes and pull requests
- added a staging GitHub Actions workflow to auto-deploy successful `develop` builds into a staging environment
- added a manual GitHub Actions release workflow for guarded remote deploys and smoke checks
- deduplicated repository-side deploy logic behind a reusable GitHub composite action
- added a release workflow audit to keep GitHub secret usage aligned with RUNBOOK.md
- updated smoke checks to accept the authenticated `/app` redirect behavior now enforced by middleware

## v0.1.0

Initial public release candidate for hiring/demo review.

Highlights:

- deployment dashboard with runtime operations and deployment detail pages
- server registry with connection tests, diagnostics, and port suggestions
- deployment templates with preview, filters, and usage tracking
- admin users workspace with saved views, audit, exports, and bulk actions
- admin upgrade inbox with saved views, audit, exports, and bulk actions
- backup bundle export and restore dry-run analysis
- remote-only production profile without default Docker socket access
- public trial signup flow with non-admin restrictions
- preflight, frontend admin smoke, and post-deploy smoke checks
