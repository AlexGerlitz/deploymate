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

## Frontend-only deploy

Local:

```bash
npm --prefix frontend run smoke:admin
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

## Backend-only deploy

Local:

```bash
python3 -m py_compile backend/app/main.py backend/app/routes/*.py backend/app/services/*.py backend/app/db.py backend/app/schemas.py
PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests -p 'test_*.py'
git status --short
git add backend
git commit -m "Describe the backend change"
git push origin develop
```

Host:

```bash
ssh <deploy-host>
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps backend
docker compose -f docker-compose.prod.yml --env-file .env.production ps backend
curl -I https://your-domain/api/health
```

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

## Post-deploy smoke

```bash
DEPLOYMATE_BASE_URL=https://your-domain \
DEPLOYMATE_ADMIN_USERNAME=admin \
DEPLOYMATE_ADMIN_PASSWORD='<secret>' \
bash scripts/post_deploy_smoke.sh
```

The scripted smoke currently validates:

- `/login`
- `/app`
- `/api/health`
- admin login
- `/api/auth/me`
- backup bundle download
- restore dry-run
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
