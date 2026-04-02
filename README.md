<p align="center">
  <img src="frontend/app/icon.svg" alt="DeployMate logo" width="96" height="96" />
</p>

<h1 align="center">DeployMate</h1>

<p align="center">
  Self-hosted Docker deployment control panel with admin tooling, operational visibility, backup dry-runs, and release safety checks.
</p>

DeployMate is a self-hosted deployment control panel for small teams that need a fast way to ship Docker containers, manage reusable templates, track operational state, and handle lightweight admin workflows from one UI.

It is built for pragmatic operator experience rather than platform complexity.

## Why This Project Is Interesting

- one product surface covers deployments, servers, templates, activity, admin users, upgrade requests, backups, and restore dry-runs
- production release flow is already scripted with preflight and post-deploy smoke checks
- the admin surface has saved views, bulk actions, exports, audit history, and backup tooling
- production security posture was improved with a remote-only deployment profile and safer SSH defaults

## At A Glance

| Area | What is already implemented |
| --- | --- |
| Deployments | create, redeploy, inspect, delete, logs, health, activity |
| Servers | saved SSH targets, connection tests, diagnostics, suggested ports |
| Templates | reusable presets, usage tracking, preview, duplicate, filters |
| Admin users | filters, saved views, bulk actions, exports, audit trail |
| Upgrade inbox | filters, saved views, bulk actions, exports, audit trail |
| Recovery | backup bundle export and restore dry-run conflict analysis |
| Release safety | preflight, admin smoke, post-deploy smoke |

## Feature Highlights

### Deployment operations

- create, redeploy, inspect, and delete Docker deployments
- support reusable deployment templates with usage tracking and preview
- inspect logs, health, activity, and external port mappings
- target either local Docker or remote SSH hosts, with production capable of running in remote-only mode

### Server management

- register remote servers with password or SSH-key auth
- test connectivity before using a target
- run diagnostics and fetch suggested free ports

### Admin tooling

- manage users, roles, plans, and password-reset state
- process upgrade requests with filters, exports, bulk actions, and audit trail
- use saved views for both users and upgrade inbox workflows
- export admin data and operational snapshots as JSON or CSV

### Backup and recovery

- download a structured backup bundle
- run restore dry-run analysis without applying changes
- inspect conflicts before any future restore workflow

## Stack

- `FastAPI`
- `Next.js`
- `PostgreSQL`
- `Docker Compose`
- `Caddy`

## Architecture At A Glance

```text
Browser
  -> Next.js frontend
    -> FastAPI backend
      -> PostgreSQL
      -> Docker runtime or remote SSH targets
```

More detail: see [ARCHITECTURE.md](ARCHITECTURE.md).

## Repository Tour

- `backend/` FastAPI application and deployment orchestration
- `frontend/` Next.js application and admin/operator UI
- `scripts/` release, smoke, and preflight automation
- `deploy/` production reverse-proxy config
- `docker-compose.prod.yml` production stack definition

## Key Screens In The App

- `/app` operations dashboard
- `/deployments/[deploymentId]` deployment detail view
- `/app/users` admin users workspace
- `/app/upgrade-requests` admin upgrade inbox
- `/login` and `/change-password` auth flow

## Production Readiness Signals

- scripted preflight in [scripts/preflight.sh](scripts/preflight.sh)
- scripted post-deploy smoke in [scripts/post_deploy_smoke.sh](scripts/post_deploy_smoke.sh)
- dedicated admin frontend smoke in [scripts/frontend_admin_smoke.sh](scripts/frontend_admin_smoke.sh)
- backend unit tests for restore analysis, admin helpers, and SSH option policy
- release and rollback notes in [RUNBOOK.md](RUNBOOK.md) and [SAFE-RELEASE.md](SAFE-RELEASE.md)

## Demo Walkthrough

If I were demoing the project to a reviewer, I would open it in this order:

1. `/app` for the operations overview
2. `/deployments/[deploymentId]` for runtime state, logs, and health
3. `/app/users` for saved views, bulk actions, audit, and backup tooling
4. `/app/upgrade-requests` for admin workflow depth and export/reporting features

## Local Development

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Default local URLs:

- frontend: `http://127.0.0.1:3000`
- backend: `http://127.0.0.1:8000`

## Production Deployment

Production deployment uses:

- `docker-compose.prod.yml`
- [PRODUCTION.md](PRODUCTION.md)
- [RUNBOOK.md](RUNBOOK.md)

Typical release flow:

```bash
./scripts/preflight.sh
npm --prefix frontend run smoke:admin
npm --prefix frontend run build
git push origin develop
ssh <deploy-host>
cd /opt/deploymate
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps frontend
DEPLOYMATE_BASE_URL=https://your-domain DEPLOYMATE_ADMIN_USERNAME=admin DEPLOYMATE_ADMIN_PASSWORD='<secret>' bash scripts/post_deploy_smoke.sh
```

## Security Posture

This project is production-usable, but still intentionally closer to a strong MVP than to a finished enterprise platform.

Current strengths:

- user passwords are hashed
- admin audit trail exists for user and upgrade actions
- restore flow is dry-run only
- SSH host key checking now defaults to `accept-new` instead of `no`
- SSH host key behavior is configurable through environment variables
- production now defaults to a remote-only profile without Docker socket access in the backend
- the production frontend can be built with local deployment controls disabled to match the backend capability boundary

Current tradeoffs:

- server credentials are still stored by the application to support remote deployment workflows
- local Docker control is still available as an opt-in capability when explicitly enabled
- local Docker control and remote SSH control still live in the same backend service boundary

These are conscious MVP tradeoffs, not hidden assumptions.

## Repository Guide

Start here:

- [README.md](README.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [PRODUCTION.md](PRODUCTION.md)
- [RUNBOOK.md](RUNBOOK.md)
- [SAFE-RELEASE.md](SAFE-RELEASE.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## Roadmap

Next likely improvements:

1. encrypt server credentials at rest or move them to external secret management
2. split local Docker execution into a narrower executor boundary
3. move from `accept-new` to a stricter pinned known-host workflow
4. deepen automated smoke coverage around deployment runtime flows

Longer-term direction: see [ROADMAP.md](ROADMAP.md).

## Status

The project is actively iterated in `develop`, with a working production deployment, scripted release checks, and a substantial admin/ops surface already in place.
