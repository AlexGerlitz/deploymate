# DeployMate Handoff

Updated: 2026-04-02

## Current State

- Branch: `main`
- Working tree: clean
- Latest commit: `e2e9d2a` `Refine shared admin filter helpers`
- `origin/main` and `origin/develop` are aligned to the same commit
- Remote checkout on `deploymate` is still behind at `d4cf16a`

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

The recent frontend refactor moved the remaining repeated admin-page state into shared helpers:

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

GitHub/repository presentation posture now matters explicitly:

- keep `main` as the presentation branch
- keep `main` and `develop` aligned when a batch is stable enough for public review
- prefer reviewer-friendly commit history over noisy incremental push history
- update docs/changelog together with meaningful product or architecture changes

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

The admin-page shared-state cleanup is already merged and both main branches are aligned.

The next high-value step is one of these:

- update the production VPS checkout from `d4cf16a` to `e2e9d2a` if you want server checkout parity with GitHub
- improve public repo presentation further:
  - screenshots / GIFs in [README.md](/Users/alexgerlitz/deploymate/README.md)
  - stronger release notes in [CHANGELOG.md](/Users/alexgerlitz/deploymate/CHANGELOG.md)
  - optional GitHub Release for `v0.1.0`
- continue product/security depth in reviewer-friendly batches

If continuing implementation work, keep this rule:

- `develop` is the active integration branch
- `main` is the public presentation branch
- once a batch is stable and tells a coherent story, align `main` again

## If You Need To Resume Fast

1. Open [HANDOFF.md](/Users/alexgerlitz/deploymate/HANDOFF.md)
2. Confirm current commit with `git rev-parse --short HEAD`
3. Confirm both public branches are still aligned if presentation matters:
   - `git log --oneline --decorate -n 4 --all --simplify-by-decoration`
4. If deploying from git, update `/opt/deploymate` as needed
5. Re-run when touching frontend/admin surfaces:
   - `FRONTEND_SMOKE_PORT=3002 npm --prefix frontend run smoke:admin`
   - `npm --prefix frontend run build`
