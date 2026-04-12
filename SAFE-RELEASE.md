# Safe Release Flow

This file captures the lowest-risk order of operations before a production push.

## 1. Freeze the recovery point

Local:

```bash
git status --short
git log --oneline -n 5
```

Host:

```bash
ssh <deploy-host>
cd /opt/deploymate
git log --oneline -n 5
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Do not continue until the fallback commit is known.

## 2. Keep the change narrow

Prefer one release surface at a time:

- frontend-only
- backend-only
- infra-only
- auth or permissions

Do not bundle unrelated UI, API, and deployment changes unless a full stack release is required.

## 3. Run local preflight

```bash
./scripts/preflight.sh
```

If preflight fails, stop there.
This now includes the runtime capability contract audit and the production env audit, so frontend local-deploy controls cannot drift away from backend runtime policy and insecure production env overrides get caught before deploy.

For a single local gate that also runs the frontend smokes and backend test suite:

```bash
bash scripts/release_workflow.sh --surface full
```

## 4. Deploy the smallest surface

- frontend-only deploy when only `frontend/` changed
- backend-only deploy when only `backend/` changed
- full stack deploy only when backend, frontend build args, or compose settings changed

## 5. Run smoke immediately after deploy

```bash
DEPLOYMATE_BASE_URL=https://your-domain \
DEPLOYMATE_ADMIN_USERNAME=admin \
DEPLOYMATE_ADMIN_PASSWORD='<secret>' \
bash scripts/post_deploy_smoke.sh
```

Or use the scripted remote release path to do remote sync, rebuild, and smoke as one ordered operation:

```bash
bash scripts/remote_release.sh \
  --host <deploy-host> \
  --surface full \
  --base-url https://your-domain \
  --admin-username admin \
  --admin-password '<secret>'
```

That remote helper now validates the target host env file and pinned `known_hosts` file before it runs `docker compose up`.
It also compares the provided smoke credentials with the effective admin credentials from the target runtime env file before deploy starts.
It also performs a fast smoke-credentials precheck against the current target and aborts early on explicit `401` or `403` auth failures, so bad admin secrets stop the release before the remote rebuild starts.

For teams that want a guarded click-to-release path, the repository also includes `.github/workflows/release.yml`, a manual GitHub Actions workflow that runs the same remote helper with repository secrets and an environment gate.

If a separate staging host exists, prefer `.github/workflows/staging.yml` on `develop` first and keep `.github/workflows/release.yml` as the explicit production promotion step.

This validates:

- `/login`
- `/app`
- `/api/health`
- admin login
- `/api/auth/me`
- backup bundle
- restore dry-run
- logout and session invalidation

## 6. Fall back only to a known commit

Never improvise rollback targets.

```bash
ssh <deploy-host>
cd /opt/deploymate
git log --oneline -n 10
git switch --detach <last_known_good_commit>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 7. Extra caution zones

If a change touches authentication, deployment creation, deployment deletion, or server connectivity:

- run local preflight
- deploy the smallest possible surface
- repeat the smoke check immediately after deploy
