# DeployMate Architecture

## Overview

DeployMate is a three-layer web application:

```text
Next.js frontend
  -> FastAPI backend
    -> PostgreSQL
    -> Docker runtime or remote SSH targets
```

The frontend is responsible for operator workflows and admin UX. The backend owns authentication, persistence, deployment orchestration, audit data, exports, and restore analysis.

## Main Application Areas

### Frontend

Relevant files:

- `frontend/app/app/page.js`
- `frontend/app/app/server-review/page.js`
- `frontend/app/app/deployment-workflow/page.js`
- `frontend/app/deployments/[deploymentId]/page.js`
- `frontend/app/app/users/page.js`
- `frontend/app/app/upgrade-requests/page.js`
- `frontend/app/app/admin-ui.js`

Responsibilities:

- beginner-path overview and task-first guidance
- server connection and verification workflow
- deployment workflow, live review, and deployment forms
- deployment detail inspection
- admin users and upgrade inbox workflows
- saved views, bulk actions, exports, and backup/restore UX
- smoke-test anchors for stable UI verification

### Backend

Relevant files:

- `backend/app/main.py`
- `backend/app/routes/auth.py`
- `backend/app/routes/deployments.py`
- `backend/app/routes/servers.py`
- `backend/app/routes/notifications.py`
- `backend/app/routes/ops.py`
- `backend/app/routes/root.py`
- `backend/app/services/deployments.py`
- `backend/app/db.py`

Responsibilities:

- session-based authentication
- deployment lifecycle endpoints
- server connectivity and diagnostics
- ops overview and exports
- admin overview, audit, backup bundle, and restore dry-run
- deployment execution against local Docker or remote SSH targets

## Data Model Themes

The backend database layer currently covers:

- users and password state
- servers and SSH connection material
- deployments and templates
- notifications and activity history
- upgrade requests
- audit events

The app uses additive schemas and read-friendly APIs for most admin and reporting surfaces.

## Deployment Model

DeployMate supports two runtime styles:

### Local runtime

- backend executes Docker commands on the same host
- intended mainly for local development or explicitly enabled environments

### Remote runtime

- backend connects to saved SSH targets
- remote host runs Docker commands
- production can be configured as remote-only, disabling local host deployments entirely

## Safety Model

Current safety mechanisms:

- release preflight before push
- post-deploy scripted smoke check
- dedicated frontend admin smoke
- restore flow limited to dry-run analysis
- strict pinned SSH default: `StrictHostKeyChecking=yes` with a real `known_hosts` file
- remote-only production profile without default Docker socket exposure

## Tradeoffs

Current MVP tradeoffs:

- server credentials are still application-managed
- Docker execution and remote SSH orchestration still share one backend service
- not every runtime path has deep automated coverage yet

## Suggested Reading Order

1. `README.md`
2. `frontend/app/app/page.js`
3. `frontend/app/app/server-review/page.js`
4. `frontend/app/app/deployment-workflow/page.js`
5. `frontend/app/deployments/[deploymentId]/page.js`
6. `backend/app/main.py`
7. `backend/app/routes/deployments.py`
8. `backend/app/routes/root.py`
