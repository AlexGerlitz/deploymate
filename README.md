# DeployMate

DeployMate is a self-hosted Docker deployment control panel for small teams that need a fast way to ship containers, track operational state, manage reusable templates, and run lightweight admin workflows from one UI.

It is built for pragmatic operator experience rather than platform complexity:
- deploy containers locally or to remote SSH hosts
- keep reusable deployment templates
- inspect activity, notifications, diagnostics, and admin audit history
- manage users, upgrade requests, backups, and restore dry-runs from the same app

## Stack

- `FastAPI` backend
- `Next.js` frontend
- `PostgreSQL`
- `Docker Compose`
- `Caddy` reverse proxy for production

## What The Product Already Does

- application dashboard with deployment, server, template, and activity overviews
- server registry with SSH connection testing and diagnostics
- deployment create/redeploy/delete flows
- template save, duplicate, filter, and usage tracking
- admin users page with filters, exports, audit, saved views, and bulk actions
- admin upgrade inbox with filters, exports, audit, saved views, and bulk actions
- backup bundle export plus restore dry-run and conflict analysis
- scripted local and production smoke checks

## Local Development

Backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Default local URLs:
- frontend: `http://127.0.0.1:3000`
- backend: `http://127.0.0.1:8000`

## Production

Production deployment uses:
- `docker-compose.prod.yml`
- `PRODUCTION.md`
- `RUNBOOK.md`

Typical release flow:

```bash
./scripts/preflight.sh
npm --prefix frontend run smoke:admin
npm --prefix frontend run build
git push origin develop
ssh deploymate
cd /opt/deploymate
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps frontend
DEPLOYMATE_BASE_URL=https://your-domain DEPLOYMATE_ADMIN_USERNAME=admin DEPLOYMATE_ADMIN_PASSWORD='<secret>' bash scripts/post_deploy_smoke.sh
```

## Quality Signals

- production smoke script for login, app shell, health, backup bundle, restore dry-run, and logout
- dedicated admin frontend smoke coverage
- backend unit tests for restore dry-run and admin helper logic
- additive admin operations surface built and deployed in small release batches

## Security Posture

This project is production-usable, but it is still intentionally closer to a strong MVP than to a finished enterprise platform.

Current strengths:
- user passwords are hashed
- admin audit trail exists for user and upgrade actions
- restore flow is dry-run only
- SSH host key checking now defaults to `accept-new` instead of `no`
- host key policy is configurable through environment variables

Current tradeoffs:
- server credentials are still stored by the application to support remote deployment workflows
- the production backend currently mounts Docker socket access when local-on-host deployment is enabled
- local Docker control and remote SSH control live in the same backend service

These are conscious MVP tradeoffs, not hidden assumptions. If I were continuing the hardening track, the next steps would be:
1. move server secrets to encrypted storage or external secret management
2. split local Docker control into a narrower executor boundary
3. make Docker socket access opt-in via a separate deployment profile
4. move from `accept-new` to pinned known-host workflows by default

## Repository Notes

For employer review, the most meaningful files are:
- `README.md`
- `PRODUCTION.md`
- `RUNBOOK.md`
- `SAFE-RELEASE.md`

## Status

The project is actively iterated in `develop`, with working production deployment and release smoke coverage already in place.
