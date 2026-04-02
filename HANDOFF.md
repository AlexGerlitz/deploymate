# DeployMate Handoff

Updated: 2026-04-02

## Current State

- Branch: `develop`
- Working tree: clean
- Latest commit: `7009c09` `Extract admin export utilities`
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
- [admin-saved-views.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-saved-views.js)
- [admin-page-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-page-utils.js)
- [admin-export-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-export-utils.js)

The latest sequence of frontend cleanup commits:

- `467143d` `Extract shared admin smoke fixtures`
- `444831d` `Consolidate auth smoke fixtures`
- `1fe613f` `Stabilize frontend build gate`
- `8a891cc` `Extract admin saved view helpers`
- `4c5a0ea` `Extract admin page utilities`
- `7009c09` `Extract admin export utilities`

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

The next high-value frontend cleanup is:

- extract shared saved-views persistence and query-sync logic from:
  - [users page](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
  - [upgrade requests page](/Users/alexgerlitz/deploymate/frontend/app/app/upgrade-requests/page.js)

That is the biggest remaining repeated block in the frontend admin surface.

Concrete target areas:

- `localStorage` load/persist helpers
- URL query param sync
- debounced search/audit sync wiring
- possibly a shared hook for admin saved views state

## If You Need To Resume Fast

1. Open [HANDOFF.md](/Users/alexgerlitz/deploymate/HANDOFF.md)
2. Confirm current commit with `git rev-parse --short HEAD`
3. Start from the next step above
4. Re-run:
   - `FRONTEND_SMOKE_PORT=3002 npm --prefix frontend run smoke:admin`
   - `npm --prefix frontend run build`

