# DeployMate Handoff

Updated: 2026-04-02

## Current State

- Branch: `develop`
- Working tree: dirty
- Latest commit: `0d049e3` `Add session handoff`
- `origin/develop` is up to date
- Remote checkout on `deploymate` is synced to the same commit in `/opt/deploymate`

## What Was Already Completed

### Runtime, release, and security

- backend HTTP-level API flow tests added for:
  - deployments
  - servers
  - admin
  - templates
  - ops
  - auth
- live release path was validated against `deploymatecloud.ru`
- full runtime smoke flow was validated live:
  - `create -> health -> diagnostics -> logs -> activity -> delete`
- release tooling was built out:
  - `scripts/preflight.sh`
  - `scripts/release_workflow.sh`
  - `scripts/remote_release.sh`
  - `.github/workflows/ci.yml`
  - `.github/workflows/staging.yml`
  - `.github/workflows/release.yml`
- security posture was hardened:
  - strict SSH known-hosts handling
  - helper for pinned known hosts
  - encrypted server credentials fail-fast policy
  - local Docker explicit opt-in / remote-only production defaults
  - capability audits wired into release/security gates

### Backend architecture

- runtime executors split out of deployment service
- server diagnostics extracted into its own service
- deployment observability extracted into its own service
- deployment mutations extracted into their own service
- deployment templates extracted into their own service
- deployment routes split into dedicated router modules

### Frontend product and smoke coverage

- smoke coverage exists for:
  - auth
  - admin
  - admin interactions
  - ops
  - restore
  - runtime
  - servers
  - templates
- deployment detail UX was improved
- restore dry-run report UX was improved

## Latest Frontend Architecture Cleanup

The recent work was focused on shrinking the two heaviest admin pages:

- [users page](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [upgrade requests page](/Users/alexgerlitz/deploymate/frontend/app/app/upgrade-requests/page.js)

Shared frontend libs added recently:

- [smoke-fixtures.js](/Users/alexgerlitz/deploymate/frontend/app/lib/smoke-fixtures.js)
- [admin-smoke-fixtures.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-smoke-fixtures.js)
- [admin-page-hooks.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-page-hooks.js)
- [admin-saved-views.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-saved-views.js)
- [admin-page-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-page-utils.js)
- [admin-export-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-export-utils.js)

The previous cleanup commit sequence in git was:

- `467143d` `Extract shared admin smoke fixtures`
- `444831d` `Consolidate auth smoke fixtures`
- `1fe613f` `Stabilize frontend build gate`
- `8a891cc` `Extract admin saved view helpers`
- `4c5a0ea` `Extract admin page utilities`
- `7009c09` `Extract admin export utilities`

The current uncommitted frontend refactor built on top of that and already moved the remaining repeated admin-page state into shared helpers:

- shared debounced value hook
- shared localStorage load helpers
- shared saved-views manager hook
- shared audit-views manager hook
- shared saved-view CRUD/import/export helpers
- shared query/filter-state helpers
- shared filter-chip builders
- shared audit-event sort helper

Current file sizes after the refactor:

- [users page](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js) -> `1983` lines
- [upgrade requests page](/Users/alexgerlitz/deploymate/frontend/app/app/upgrade-requests/page.js) -> `1525` lines

## What Was Verified Recently

- `FRONTEND_SMOKE_PORT=3002 npm --prefix frontend run smoke:admin` -> ok
- `npm --prefix frontend run build` -> ok in clean single-process runs
- `bash scripts/preflight.sh` -> ok
- `bash scripts/security_audit.sh` -> ok
- `bash scripts/local_runtime_audit.sh` -> ok

## Important Local Caveat

Next.js build/dev in this environment can give false negatives if multiple frontend processes touch `frontend/.next` at the same time.

Typical symptoms:

- `PageNotFoundError` for random routes like `/change-password`, `/_document`, `/_not-found`
- `ENOENT` around `.next/export/...`

What already fixed the real release gate:

- `scripts/preflight.sh` now clears stale `frontend/.next` before build
- `scripts/release_workflow.sh` now does the same

Practical rule:

- run `npm --prefix frontend run build` alone
- avoid overlapping `next dev` / smoke scripts with `next build`

## Best Next Step

The biggest repeated saved-views/query-sync block is already extracted.

The next high-value step is one of these:

- commit the current frontend refactor
- do a final cleanup pass on helper naming / API shape in:
  - [admin-page-hooks.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-page-hooks.js)
  - [admin-page-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-page-utils.js)
  - [admin-saved-views.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-saved-views.js)
- or continue shrinking the pages by extracting config-driven admin filter definitions / fetch parameter builders

If continuing code cleanup before commit, the best concrete target is:

- remove remaining page-local filter config duplication between:
  - [users page](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
  - [upgrade requests page](/Users/alexgerlitz/deploymate/frontend/app/app/upgrade-requests/page.js)
- consider a tiny shared helper for admin filter definitions / fetch params
- then re-run build + admin smoke and commit

If you want to stop cleanup work and ship, this is already at a good commit point.

## If You Need To Resume Fast

1. Open [HANDOFF.md](/Users/alexgerlitz/deploymate/HANDOFF.md)
2. Confirm current commit with `git rev-parse --short HEAD`
3. Check current frontend edits with `git status --short`
4. Either commit the refactor or continue from the next step above
5. Re-run:
   - `FRONTEND_SMOKE_PORT=3002 npm --prefix frontend run smoke:admin`
   - `npm --prefix frontend run build`
