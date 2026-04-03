# DeployMate Production Runbook

This runbook is the operator-facing reference for updating a production DeployMate instance.

## Assumptions

- the repository is checked out on the deployment host at `/opt/deploymate`
- the deployment host is reachable as `ssh <deploy-host>`
- production uses `docker-compose.prod.yml` with `.env.production`

## Fast checks

```bash
ssh <deploy-host>
cd /opt/deploymate
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=50 proxy
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=50 backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=50 frontend
curl -I https://your-domain
curl -I https://your-domain/app
curl -I https://your-domain/api/health
```

Before any release from the workstation:

```bash
./scripts/preflight.sh
```

For the fastest local loop, use the new lightweight commands:

```bash
make changed
make profile-changed
make profile-frontend
make profile-backend
make profile-fast
make profile-frontend-hot
make profile-fast-hot
make frontend-smoke-server-status
make frontend-smoke-server-stop
make audit-cache-clear
make frontend
make frontend-hot
make backend
make fast
make fast-hot
```

These commands:

1. detect the changed release surface locally when needed
2. run the smaller `--fast` local gate instead of the full release gate
3. skip the production frontend build in preflight fast mode
4. keep backend verification on a targeted test set when changed files map cleanly, otherwise fall back to the focused safety suite
5. skip the backend fast suite entirely when a mixed local diff does not actually touch backend or release-runtime backend contract
6. narrow backend syntax in preflight to changed backend Python files when possible, and skip it entirely for frontend-only local diffs
7. skip the frontend fast smokes entirely when a mixed local diff does not actually touch frontend or frontend delivery contract
8. keep frontend verification on targeted fast smokes when changed files map cleanly, otherwise fall back to the default `auth + ops + runtime`
9. auto-derive the same local diff context for explicit surface commands like `make frontend`, `make backend`, `make profile-frontend`, and `make profile-backend`
10. keep `release_workflow_audit` enabled for release-contract diffs while still letting local `security_audit` stay on changed-file scope when a full tracked-file scan is unnecessary
11. keep experimental persistent frontend smoke-server controls available, but leave the default fast loop on the safer per-command lifecycle unless `FRONTEND_SMOKE_PERSIST_SERVER=1` is set explicitly
12. reuse one shared frontend smoke dev server in fast mode instead of starting a new `next dev` process for each smoke
13. reuse shared frontend smoke servers in the heavier full gate too, so the main frontend smoke pack no longer starts a separate `next dev` process per script
14. cache repeated local audit steps inside one gate run, so nested security/runtime audits do not re-run the same expensive checks twice
15. skip runtime-oriented local audits automatically when the current diff does not touch runtime or deploy contract files
16. narrow local `security_audit` to changed files and skip nested release or credentials audits unless the diff touches those contracts
17. split local `security_audit` into secret scan and runtime-policy scan, so docs or release-contract diffs still keep the right checks without scanning risky runtime defaults unnecessarily
18. persist successful local secret-scan and runtime-policy results by fingerprint, so repeated commands on the same diff do not re-run them unnecessarily
19. reuse fingerprint-cached results for repeated local release-contract and runtime-contract audits when their inputs stay the same
20. print a timing summary for local preflight and release phases so the slowest step is visible immediately after each run
21. print a short cache-hit summary after local preflight, release, and profile commands so saved reruns are visible immediately
22. reuse phase-level fingerprint caches for repeated fast frontend smoke targets and backend fast test modules when the diff and inputs stay the same
23. reuse phase-level fingerprint caches for repeated preflight backend syntax checks and local frontend builds when their inputs stay the same
24. reuse a phase-level fingerprint cache for repeated `security_audit` blocks when the diff, scopes, and nested audit inputs stay the same
25. reuse per-file fingerprints for changed-file `security_audit` secret and runtime-policy scans, so one extra file in the diff does not invalidate every unchanged security target
26. reuse per-file fingerprints for repeated local runtime static-contract checks, so one changed runtime/deploy file does not force rechecking every unchanged runtime contract file
27. reuse per-file extracted contract lists for `release_workflow_audit`, so changing one of `release.yml`, `staging.yml`, or `RUNBOOK.md` does not force reparsing the other two
28. print family-level cache savings for `security`, `release_contract`, and `runtime`, so repeated local runs show which verification layer still dominates cost
29. keep local diff-context derivation stable even when there are no changed files and print a family bottleneck hint, so explicit surface commands stay predictable and still show which verification family is dominating misses
30. prefer per-file fingerprint reuse for `security_audit` secret and runtime-policy scans even in wider scopes when the file set is still manageable, so repeat full-scope checks stop rescanning the entire repo
31. recommend the cheapest useful local loop for the current diff via `make recommend-local-mode`, so you spend less time choosing between `make changed`, `make backend`, `make frontend-hot`, or `make profile-changed`
32. narrow `make changed` mixed diffs down to an effective `frontend` or `backend` fast surface when the other side already resolves to `skip`, so shared-but-one-sided changes stop paying for both halves
33. execute the recommended local loop directly via `make auto-local`, including automatic switching between fast and profile modes when the diff is expensive enough to justify profiling context
34. remember the last successful `auto-local` loop per diff family and print a cheaper follow-up command for the next tweak, so second-pass iterations shrink automatically
35. append each local timing phase into `.logs/local_gate_timing.csv` so repeated runs can be compared over time
36. keep project-specific path and route assumptions inside `scripts/project_automation_config.sh`, so the automation core can be ported to another repo without rewriting every script first
37. keep project-specific path-to-target and path-to-scope rules inside `scripts/project_automation_targets.sh`, so the `detect_*` layer is portable too
38. export the reusable automation layer with `make export-automation-core` when you want to move the core into a separate private repository
39. keep frontend smoke assertions inside `scripts/project_automation_smoke_checks.sh`, so both the fast and heavier smoke runners stay reusable across projects

To inspect the latest local timings quickly:

```bash
make timing-history
make timing-stats
make timing-hint
```

For repeated frontend iterations, the faster hot loop is:

```bash
make frontend-hot
make profile-frontend-hot
make frontend-smoke-server-status
make frontend-smoke-server-stop
```

Or run the broader local release gate:

```bash
bash scripts/release_workflow.sh --surface full
```

Fast mode is also available directly:

```bash
bash scripts/release_workflow.sh --surface frontend --fast
bash scripts/release_workflow.sh --surface backend --fast
bash scripts/release_workflow.sh --surface full --fast
```

For template-heavy frontend changes, also run:

```bash
npm --prefix frontend run smoke:templates
```

The full local release gate already includes this templates smoke alongside the admin and runtime frontend smokes.

For ops-overview focused frontend changes, also run:

```bash
npm --prefix frontend run smoke:ops
```

For auth-surface frontend changes, also run:

```bash
npm --prefix frontend run smoke:auth
```

For admin interaction changes around saved views, audit filters, or bulk actions, also run:

```bash
npm --prefix frontend run smoke:admin-interactions
```

For backup / restore dry-run workflow changes, also run:

```bash
npm --prefix frontend run smoke:restore
```

For server-management frontend changes, also run:

```bash
npm --prefix frontend run smoke:servers
```

For a single remote deploy command that also runs post-deploy smoke:

```bash
bash scripts/remote_release.sh \
  --host <deploy-host> \
  --surface full \
  --base-url https://your-domain \
  --admin-username admin \
  --admin-password '<secret>'
```

If you want the same flow from GitHub instead of a workstation shell, use the manual workflow in `.github/workflows/release.yml` after configuring repository secrets for the deploy host, deploy SSH key, pinned known_hosts contents, base URL, and admin smoke credentials.

Recommended promotion order:

1. open and review a PR into `develop`
2. merge the reviewed PR into `develop`
3. `.github/workflows/ci.yml` runs the release gate and then auto-deploys the same commit to staging
4. production deploy stays behind `.github/workflows/release.yml` or a manual `scripts/remote_release.sh` run

The CI and release workflows call the same reusable composite action in `.github/actions/remote-release/action.yml`, so staging and production deploy behavior stays aligned with `scripts/remote_release.sh`.
Those workflows pass the exact checked-out commit SHA into the remote helper, so the release host deploys the reviewed commit rather than whichever newer commit happens to land on the branch later.

For the next project, the fastest non-empty starting point is now the product starter:

```bash
make bootstrap-product-starter TARGET_DIR=/absolute/path/to/project PRODUCT_STARTER_FLAGS="--project-name MyApp --app-slug myapp --contact-email founder@example.com --frontend-dir web --backend-dir api"
```

That gives the new repo:

- starter frontend shell
- starter backend shell
- starter docs
- reusable automation core

Then immediately scaffold the first product slice:

```bash
make scaffold-product-resource TARGET_DIR=/absolute/path/to/project RESOURCE_FLAGS="--name Projects --slug projects --frontend-dir web --backend-dir api"
```

Recommended PR-first daily flow:

```bash
git switch develop
git pull --ff-only origin develop
make start-pr-branch SLUG=my-change
make git-doctor
make ship-pr SLUG=my-change MESSAGE="Describe the change"
```

Then:

1. commit the change on the feature branch
2. run `make pr-ready`
3. push with `git push -u origin $(git branch --show-current)`
4. open the PR with `make pr-open`
5. use `make pr-status` while the PR is under review
6. wait with `make pr-watch`
7. merge with `make pr-land`

If you want to compress even more of the Git overhead into one path:

```bash
make ship-pr SLUG=my-change MESSAGE="Describe the change"
make pr-watch
make pr-land-sync
```

Notes:

- PR CI already runs the same release gate as direct `develop` pushes
- auto-staging still happens only after merge into `develop`
- `.github/pull_request_template.md` keeps the PR body short and predictable
- `make pr-ready` uses the same recommendation and `auto-local` logic as the normal local loop, so the pre-PR check is not a second parallel process
- `make pr-doctor` prints branch cleanliness, upstream state, PR state, local-loop freshness, and a PR size class so oversized branches get caught before review
- `make pr-doctor` also reads the current PR check state from GitHub and suggests a likely split direction from the diff mix when a branch has grown too large
- `make pr-doctor` now also compares the current local commit, the last locally verified commit, and the PR head SHA on GitHub so stale local green runs or unpushed commits are obvious before review
- `make pr-watch` waits on GitHub checks and then refreshes doctor output
- `make pr-land` refuses to merge unless doctor is clean, local `HEAD` matches the PR head SHA, and PR checks are green
- `make pr-land-sync` merges the PR and then fast-forwards `main` from `develop`
- `make dev-doctor` gives one compact local summary of recommended loop, timing bottleneck, and PR doctor state
- `make git-doctor` gives one compact Git-only summary of branch cleanliness, upstream drift, stale lock state, and the most useful next Git command
- doctor commands now also support `--format shell`, so future repos can automate around them without parsing human-oriented text

For daily iteration speed on staging:

```bash
git push origin develop
```

After the push:

1. CI detects the changed surface once and uses that same decision for the release gate and the staging deploy
2. if the commit changes only `frontend/`, staging deploy rebuilds `frontend`
3. if the commit changes only `backend/`, staging deploy rebuilds `backend`
4. mixed or shared changes fall back to a full staging deploy
5. docs-only or workflow-only changes skip both the release gate and staging deploy entirely
6. older in-progress CI runs on the same branch are cancelled automatically so only the newest iteration keeps running
7. the release gate now skips unnecessary dependency installs too, so frontend-only changes do not install backend requirements and backend-only changes do not install frontend packages

Use `.github/workflows/staging.yml` only as a manual fallback when you need to redeploy staging on demand.
That manual fallback now also supports `skip_smoke` when you need a faster redeploy for operator-only checks.

For current DeployMate feature work, do not start every new admin surface from a blank file. Use:

```bash
make scaffold-deploymate-surface SURFACE_FLAGS="--name Review Inbox --slug review-inbox"
```

That gives you the frontend page shell, backend route/service stub, backend API flow test, and `backend/app/main.py` registration in one pass.
The generated page now also uses shared review-shell blocks from `frontend/app/app/admin-ui.js`, so new admin surfaces start from the same summary-and-queue pattern instead of ad hoc JSX.
The backend side now also gets typed response models in `backend/app/schemas.py`, a built-in `q` filter path, and a generated API flow test for both default and filtered list responses.
Add `--with-saved-views`, `--with-audit`, and `--with-export` when the first useful version of the surface should already include those secondary sections.
Those richer flags now also generate real starter wiring for URL state, filter chips, saved-views manager hooks, audit filtering, and local JSON/CSV exports, so the surface starts closer to a live DeployMate workflow than a blank mock.
Add `--preset users`, `--preset upgrade-requests`, or `--preset servers` when the feature already clearly matches one of those common DeployMate surface families.
Presets now also change the starter action flow itself, so the generated surface already includes the first local decision pattern for that family instead of a queue-only mock.
The generated page now also gets a preset-specific segment/workflow filter and richer card context fields, so the starter slice is closer to the actual entity shape you will build next.
The scaffold now also includes a starter bulk-action panel and a mutation payload preview, so the first write contract is visible immediately instead of being invented ad hoc later.

The CI, staging, and production workflows now write a short GitHub job summary with the chosen surface, smoke mode, requested commit SHA, deployed SHA, and target URL so the result is readable without opening raw logs.

To verify that the release workflows and the documented GitHub secret contract still match:

```bash
bash scripts/release_workflow_audit.sh
```

Before the first deploy of encrypted server credentials, or before enabling remote server management on a fresh environment:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# store the value in .env.production as DEPLOYMATE_SERVER_CREDENTIALS_KEY
```

Before switching SSH host verification to strict pinned mode:

```bash
bash scripts/prepare_known_hosts.sh --host <target-host> --port 22
# store the resulting path in .env.production as DEPLOYMATE_SSH_KNOWN_HOSTS_FILE
# then set DEPLOYMATE_SSH_HOST_KEY_CHECKING=yes
```

Do not rotate `DEPLOYMATE_SERVER_CREDENTIALS_KEY` casually. Existing stored server credentials depend on it for decryption.

To audit the current database state for server credential encryption before a release:

```bash
bash scripts/server_credentials_audit.sh
```

To verify that the repo still keeps local Docker execution behind an explicit opt-in boundary:

```bash
bash scripts/local_runtime_audit.sh
```

To verify that production frontend and backend runtime capability flags are still aligned:

```bash
bash scripts/runtime_capability_audit.sh
```

This audit checks:

- `frontend/Dockerfile` production default
- `docker-compose.prod.yml` production build and runtime defaults
- `.env.production.example`
- `.env.production` when it exists on the workstation or deployment host

If `.env.production` sets `DEPLOYMATE_LOCAL_DOCKER_ENABLED=false`, then `NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED` must be `0`. If backend local runtime is explicitly enabled, the frontend flag must be `1`.

## Frontend-only deploy

Local:

```bash
npm --prefix frontend run smoke:admin
npm --prefix frontend run smoke:runtime
npm --prefix frontend run build
git status --short
git add frontend
git commit -m "Describe the frontend change"
git push origin develop
```

Host:

```bash
ssh <deploy-host>
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps frontend
docker compose -f docker-compose.prod.yml --env-file .env.production ps frontend
curl -I https://your-domain/app
```

Single-command alternative from the workstation:

```bash
bash scripts/remote_release.sh \
  --host <deploy-host> \
  --surface frontend \
  --base-url https://your-domain \
  --admin-username admin \
  --admin-password '<secret>'
```

## Backend-only deploy

Local:

```bash
python3 -m py_compile backend/app/main.py backend/app/routes/*.py backend/app/services/*.py backend/app/db.py backend/app/schemas.py
PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests -p 'test_*.py'
PYTHONPATH=backend backend/venv/bin/python -m unittest backend.tests.test_server_credentials -v
bash scripts/security_audit.sh
git status --short
git add backend
git commit -m "Describe the backend change"
git push origin develop
```

Host:

```bash
ssh <deploy-host>
cd /opt/deploymate
grep '^DEPLOYMATE_SERVER_CREDENTIALS_KEY=' .env.production
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps backend
docker compose -f docker-compose.prod.yml --env-file .env.production ps backend
curl -I https://your-domain/api/health
```

Single-command alternative from the workstation:

```bash
bash scripts/remote_release.sh \
  --host <deploy-host> \
  --surface backend \
  --base-url https://your-domain \
  --admin-username admin \
  --admin-password '<secret>'
```

If this release introduces encrypted server credentials and production already has existing server records, the backend startup path will migrate any plaintext records to encrypted form after boot as long as `DEPLOYMATE_SERVER_CREDENTIALS_KEY` is present.

## Full stack deploy

Use a full rebuild when backend, frontend build args, or production compose settings changed.

Local:

```bash
./scripts/preflight.sh
npm --prefix frontend run smoke:admin
npm --prefix frontend run build
PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests -p 'test_*.py'
git status --short
git add .
git commit -m "Describe the release change"
git push origin develop
```

Host:

```bash
ssh <deploy-host>
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl -I https://your-domain
curl -I https://your-domain/app
curl -I https://your-domain/api/health
```

Single-command alternative from the workstation:

```bash
bash scripts/remote_release.sh \
  --host <deploy-host> \
  --surface full \
  --base-url https://your-domain \
  --admin-username admin \
  --admin-password '<secret>'
```

## Post-deploy smoke

```bash
DEPLOYMATE_BASE_URL=https://your-domain \
DEPLOYMATE_ADMIN_USERNAME=admin \
DEPLOYMATE_ADMIN_PASSWORD='<secret>' \
bash scripts/post_deploy_smoke.sh
```

Optional runtime coverage can be enabled when you want the smoke to create and remove a real test deployment:

```bash
DEPLOYMATE_BASE_URL=https://your-domain \
DEPLOYMATE_ADMIN_USERNAME=admin \
DEPLOYMATE_ADMIN_PASSWORD='<secret>' \
DEPLOYMATE_SMOKE_RUNTIME_ENABLED=1 \
DEPLOYMATE_SMOKE_SERVER_ID='<server-id>' \
bash scripts/post_deploy_smoke.sh
```

Or create a temporary smoke target on the fly from an SSH key file:

```bash
DEPLOYMATE_BASE_URL=https://your-domain \
DEPLOYMATE_ADMIN_USERNAME=admin \
DEPLOYMATE_ADMIN_PASSWORD='<secret>' \
DEPLOYMATE_SMOKE_RUNTIME_ENABLED=1 \
DEPLOYMATE_SMOKE_SERVER_HOST='203.0.113.10' \
DEPLOYMATE_SMOKE_SERVER_USERNAME='root' \
DEPLOYMATE_SMOKE_SSH_KEY_FILE="$HOME/.ssh/id_ed25519" \
bash scripts/post_deploy_smoke.sh
```

The same runtime env vars can be passed through `scripts/remote_release.sh` so a remote deploy can immediately run the deeper runtime smoke in one command:

```bash
DEPLOYMATE_SMOKE_RUNTIME_ENABLED=1 \
DEPLOYMATE_SMOKE_SERVER_HOST='203.0.113.10' \
DEPLOYMATE_SMOKE_SERVER_USERNAME='root' \
DEPLOYMATE_SMOKE_SSH_KEY_FILE="$HOME/.ssh/id_ed25519" \
bash scripts/remote_release.sh \
  --host <deploy-host> \
  --surface full \
  --base-url https://your-domain \
  --admin-username admin \
  --admin-password '<secret>'
```

GitHub Actions release workflow secrets for runtime smoke:

- `RUNTIME_SMOKE_SERVER_ID` for a pre-saved smoke target, or
- `RUNTIME_SMOKE_SERVER_HOST`, `RUNTIME_SMOKE_SERVER_USERNAME`, and `RUNTIME_SMOKE_SSH_PRIVATE_KEY` for a temporary target
- optional `RUNTIME_SMOKE_SERVER_PORT`, `RUNTIME_SMOKE_SERVER_NAME`, `RUNTIME_SMOKE_IMAGE`, `RUNTIME_SMOKE_INTERNAL_PORT`, `RUNTIME_SMOKE_EXTERNAL_PORT`, `RUNTIME_SMOKE_START_PORT`, and `RUNTIME_SMOKE_HEALTH_TIMEOUT`

Required GitHub Actions release workflow secrets:

- `DEPLOY_HOST`
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_SSH_KNOWN_HOSTS`
- `DEPLOYMATE_BASE_URL`
- `DEPLOYMATE_ADMIN_USERNAME`
- `DEPLOYMATE_ADMIN_PASSWORD`

Optional GitHub Actions release workflow secrets:

- `DEPLOY_REPO_DIR`
- `DEPLOY_BRANCH`
- `DEPLOY_ENV_FILE`
- `DEPLOY_NOTIFICATION_WEBHOOK` for best-effort Slack/Discord-compatible deploy notifications

The staging workflow uses the same secret names, but scoped under the `staging` environment instead of `production`.
If `DEPLOY_NOTIFICATION_WEBHOOK` is unset, the workflows simply skip notifications.

Runtime smoke notes:

- if `DEPLOYMATE_SMOKE_SERVER_ID` is set, the script asks `/servers/{server_id}/suggested-ports` for a free external port
- if `DEPLOYMATE_SMOKE_SERVER_ID` is empty but `DEPLOYMATE_SMOKE_SERVER_HOST`, `DEPLOYMATE_SMOKE_SERVER_USERNAME`, and `DEPLOYMATE_SMOKE_SSH_KEY_FILE` are set, the script creates and later deletes a temporary server target automatically
- if `DEPLOYMATE_SMOKE_SERVER_ID` is not set, provide `DEPLOYMATE_SMOKE_EXTERNAL_PORT` explicitly
- production can keep runtime smoke disabled when running in remote-only mode without a preconfigured smoke target
- the script always attempts to delete the temporary smoke deployment before exit
- if it created a temporary smoke server target, it also deletes that target before exit

## Deploy notifications

Release workflows can send a best-effort notification when `DEPLOY_NOTIFICATION_WEBHOOK` is configured in the target GitHub environment.

Compatible receivers:

- Slack Incoming Webhooks
- Discord channel webhooks
- any endpoint that accepts a JSON body with either `text` or `content`

Minimal Slack setup:

1. Open `Slack -> Apps -> Incoming Webhooks`.
2. Create a webhook for the channel that should receive deploy results.
3. Copy the webhook URL into the GitHub environment secret `DEPLOY_NOTIFICATION_WEBHOOK`.

Minimal Discord setup:

1. Open the target channel settings.
2. Create a channel webhook.
3. Copy the webhook URL into the GitHub environment secret `DEPLOY_NOTIFICATION_WEBHOOK`.

Local receiver test:

```bash
bash scripts/send_workflow_notification.sh \
  --webhook-url 'https://hooks.slack.com/services/...' \
  --workflow 'Auto staging deploy' \
  --environment staging \
  --status success \
  --surface frontend \
  --smoke 'runtime enabled' \
  --commit 4ac9f9e94edae459bd97b3572ac15bfdaaa547ed \
  --ref develop \
  --run-url 'https://github.com/AlexGerlitz/deploymate/actions/runs/23931028894' \
  --details 'frontend-only change detected'
```

Expected message shape:

- status line with workflow name
- environment, surface, and smoke mode
- short commit SHA and ref
- direct link to the workflow run

If `DEPLOY_NOTIFICATION_WEBHOOK` is unset or the receiver is temporarily unavailable, deploys still continue because notification steps are best-effort.

The scripted smoke currently validates:

- `/login`
- `/app`
- `/api/health`
- admin login
- `/api/auth/me`
- backup bundle download
- restore dry-run
- optional create -> health -> diagnostics -> logs -> activity -> delete deployment flow
- logout and session invalidation

## Backup and restore dry-run

```bash
curl -sS -b "<cookie jar>" https://your-domain/api/admin/backup-bundle

curl -sS -b "<cookie jar>" \
  -H "Content-Type: application/json" \
  -X POST https://your-domain/api/admin/restore/dry-run \
  --data-binary @restore-dry-run-payload.json
```

Dry-run result meanings:

```text
ok      section looks safe to import later
warn    review is required before any future restore
error   blockers exist and the payload should not be applied
```

## Remote-only production defaults

Standard production is intentionally configured as:

```text
DEPLOYMATE_LOCAL_DOCKER_ENABLED=false
NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0
```

If either capability flag changes, rebuild both backend and frontend with the full stack flow.

## Fallback procedure

1. Identify the last known good commit.
2. Switch the deployment host to that commit in detached mode.
3. Rebuild the smallest affected surface.
4. Re-run the smoke check immediately.

Example:

```bash
ssh <deploy-host>
cd /opt/deploymate
git log --oneline -n 10
git switch --detach <last_known_good_commit>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
curl -I https://your-domain
curl -I https://your-domain/app
curl -I https://your-domain/api/health
```

## Notes

- prefer `develop` as the release branch and deploy from Git, not by editing live files
- use `--no-deps` for frontend-only and backend-only deploys
- on the production host, port `80` is already occupied by DeployMate itself, so app deployments should use other external ports
