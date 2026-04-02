<p align="center">
  <img src="frontend/app/icon.svg" alt="DeployMate logo" width="96" height="96" />
</p>

<h1 align="center">DeployMate</h1>

<p align="center">
  Self-hosted Docker deployment control panel with admin tooling, operational visibility, backup dry-runs, and release safety checks.
</p>

<p align="center">
  <a href="https://deploymatecloud.ru">Live App</a>
  ·
  <a href="https://deploymatecloud.ru/register">Create Trial Account</a>
  ·
  <a href="https://deploymatecloud.ru/login">Login</a>
</p>

DeployMate is a self-hosted deployment control panel for small teams that need a fast way to ship Docker containers, manage reusable templates, track operational state, and handle lightweight admin workflows from one UI.

It is built for pragmatic operator experience rather than platform complexity.

## Try It Live

Public trial signup is enabled on the live instance:

- app: `https://deploymatecloud.ru`
- signup: `https://deploymatecloud.ru/register`
- login: `https://deploymatecloud.ru/login`

Reviewer path:

1. create a trial account
2. land in the app immediately after signup
3. open `/app/users` and `/app/upgrade-requests` to inspect the richer admin surface
4. review saved views, bulk actions, audit trail, backup bundle, and restore dry-run tooling

![Reviewer demo flow](docs/demo-flow.svg)

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
- optional public signup for safe `trial` accounts

### Server management

- register remote servers with SSH-key auth for new targets
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

![Architecture flow](docs/architecture-flow.svg)

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
- runtime capability contract audit in [scripts/runtime_capability_audit.sh](scripts/runtime_capability_audit.sh)
- scripted local release gate in [scripts/release_workflow.sh](scripts/release_workflow.sh)
- scripted remote release helper in [scripts/remote_release.sh](scripts/remote_release.sh)
- GitHub Actions CI runs the same local release gate on `develop` pushes and pull requests
- GitHub Actions staging workflow can auto-promote successful `develop` builds into a staging environment
- GitHub Actions manual release workflow can run the remote release helper against a configured host
- both repository-side deploy workflows share a reusable composite action instead of duplicating shell logic
- tracked-file security audit in [scripts/security_audit.sh](scripts/security_audit.sh)
- release workflow secret-contract audit in [scripts/release_workflow_audit.sh](scripts/release_workflow_audit.sh)
- scripted post-deploy smoke in [scripts/post_deploy_smoke.sh](scripts/post_deploy_smoke.sh)
- dedicated admin frontend smoke in [scripts/frontend_admin_smoke.sh](scripts/frontend_admin_smoke.sh)
- dedicated auth frontend smoke in [scripts/frontend_auth_smoke.sh](scripts/frontend_auth_smoke.sh)
- dedicated admin-interactions frontend smoke in [scripts/frontend_admin_interactions_smoke.sh](scripts/frontend_admin_interactions_smoke.sh) for saved views and bulk-action surfaces
- dedicated ops frontend smoke in [scripts/frontend_ops_smoke.sh](scripts/frontend_ops_smoke.sh)
- dedicated restore-report frontend smoke in [scripts/frontend_restore_smoke.sh](scripts/frontend_restore_smoke.sh)
- dedicated runtime frontend smoke in [scripts/frontend_runtime_smoke.sh](scripts/frontend_runtime_smoke.sh)
- dedicated servers frontend smoke in [scripts/frontend_servers_smoke.sh](scripts/frontend_servers_smoke.sh)
- dedicated templates frontend smoke in [scripts/frontend_templates_smoke.sh](scripts/frontend_templates_smoke.sh)
- deployment detail now includes quick reference, attention overview, and copyable runtime summary ergonomics
- backend local Docker execution is now explicit opt-in; remote-only is the default runtime posture
- operations overview now exposes backend runtime capability posture, including local Docker, SSH trust mode, and credential-key readiness
- preflight and security audit now check that production frontend and backend local-runtime flags stay aligned
- the local release gate now runs auth, admin, admin-interactions, ops, restore, runtime, servers, and templates frontend smokes before build
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
npm --prefix frontend run smoke:runtime
npm --prefix frontend run build
git push origin develop
ssh <deploy-host>
cd /opt/deploymate
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps frontend
DEPLOYMATE_BASE_URL=https://your-domain DEPLOYMATE_ADMIN_USERNAME=admin DEPLOYMATE_ADMIN_PASSWORD='<secret>' bash scripts/post_deploy_smoke.sh
```

Or use the single remote helper for prod-like or staging-like deploys:

```bash
bash scripts/remote_release.sh \
  --host <deploy-host> \
  --surface full \
  --base-url https://your-domain \
  --admin-username admin \
  --admin-password '<secret>'
```

There is also a manual GitHub Actions release workflow in [.github/workflows/release.yml](.github/workflows/release.yml) for teams that prefer a guarded repository-side trigger over running the remote helper from a workstation.

For a safer promotion path, [.github/workflows/staging.yml](.github/workflows/staging.yml) can deploy `develop` to a dedicated staging environment after CI passes, then production can stay on the manual release gate.

## Security Posture

This project is production-usable, but still intentionally closer to a strong MVP than to a finished enterprise platform.

Current strengths:

- user passwords are hashed
- server SSH credentials are encrypted at rest when persisted by the application
- admin audit trail exists for user and upgrade actions
- restore flow is dry-run only
- SSH host key checking now defaults to `accept-new` instead of `no`
- SSH host key behavior is configurable through environment variables
- production now defaults to a remote-only profile without Docker socket access in the backend
- the production frontend can be built with local deployment controls disabled to match the backend capability boundary
- production checks now fail if `.env.production` leaves backend local-runtime policy and frontend deployment controls out of sync

Current tradeoffs:

- server credentials are still application-managed, but they are encrypted at rest and require a stable `DEPLOYMATE_SERVER_CREDENTIALS_KEY`
- local Docker control is explicit opt-in and disabled by default unless `DEPLOYMATE_LOCAL_DOCKER_ENABLED=true`
- legacy password-based SSH records may still exist until they are rotated to SSH keys
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
- [CHANGELOG.md](CHANGELOG.md)

## Roadmap

Next likely improvements:

1. move server credentials to external secret management
2. split local Docker execution into a narrower executor boundary
3. move from `accept-new` to a stricter pinned known-host workflow
4. deepen automated smoke coverage around deployment runtime flows

Longer-term direction: see [ROADMAP.md](ROADMAP.md).

## Status

The project is actively iterated in `develop`, with a working production deployment, scripted release checks, and a substantial admin/ops surface already in place.
