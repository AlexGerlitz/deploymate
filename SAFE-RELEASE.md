# Safe Release Flow

This project already has deploy commands in [RUNBOOK.md](/Users/alexgerlitz/deploymate/RUNBOOK.md). This file defines the lowest-risk order of operations before any production push.

## 1. Freeze the recovery point

Run locally:

```bash
git status --short
git log --oneline -n 5
```

Run on VPS:

```bash
ssh deploymate
cd /opt/deploymate
git log --oneline -n 5
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Do not continue until you know which commit is the current fallback target.

## 2. Keep the change small

Use one branch or one commit for one purpose only:

- frontend-only
- backend-only
- infra-only
- auth or permissions

Do not bundle unrelated UI, API, and deploy changes into one release if you can avoid it.

## 3. Run local preflight

Run:

```bash
./scripts/preflight.sh
```

This checks:

- current git status
- production frontend build
- backend Python syntax compilation

If preflight fails, stop there.

## 4. Choose the smallest deploy path

Use:

- frontend-only deploy when only `frontend/` changed
- backend-only deploy when only `backend/` changed
- full stack deploy only when both changed

This reduces container churn and narrows rollback scope.

## 5. Run production smoke check

Minimum manual smoke sequence:

1. Open `/login`
2. Sign in with an admin account
3. Confirm redirect to `/app`
4. Check `Servers`
5. Check `Activity history`
6. If deploy logic changed, create one test deployment on a free external port
7. Open deployment details
8. Check logs, health, and activity
9. Delete the test deployment

## 6. Roll back only to a known commit

Never improvise rollback targets.

Use:

```bash
ssh deploymate
cd /opt/deploymate
git log --oneline -n 10
git switch develop
git reset --hard <last_known_good_commit>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Only do this after identifying the exact commit you want to restore.

## 7. Default no-risk rule

If a change touches authentication, deployment creation, deployment deletion, or server connectivity:

- run local preflight
- deploy the smallest possible surface
- repeat the smoke check immediately after deploy
