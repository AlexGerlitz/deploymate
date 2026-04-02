# Changelog

## Unreleased

Highlights:

- added backend route tests for deployment redeploy, delete, and diagnostics behavior
- added an HTTP-level deployment API flow test for create -> health/logs/diagnostics/activity -> delete
- added dedicated frontend runtime smoke coverage for `/app` and `/deployments/[deploymentId]`
- extended post-deploy smoke with optional create -> health -> diagnostics -> logs -> activity -> delete runtime flow
- added a single local release workflow script for preflight, frontend smokes, build, and backend tests
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
