# Automation Core

This repo now separates reusable local automation logic from DeployMate-specific adapter values.

## Reusable core

These files are the portable part:

- `scripts/audit_cache.sh`
- `scripts/timing_history.sh`
- `scripts/profile_surface.sh`
- `scripts/dev_fast_check.sh`
- `scripts/dev_verify_changed.sh`
- `scripts/preflight.sh`
- `scripts/release_workflow.sh`
- `scripts/frontend_smoke_shared.sh`
- `scripts/lib/project_automation.sh`
- `scripts/lib/project_automation_targets.sh`

The export manifest for the private reusable bundle lives in:

- `automation-core/FILES.txt`

## Project adapter

This file is the first thing to change in another repository:

- `scripts/project_automation_config.sh`

It controls:

- frontend and backend directory layout
- backend virtualenv python path
- default frontend ready routes used by smoke helpers
- default frontend fast smoke bundle
- frontend smoke registry location

## Porting order

1. Copy the reusable core files into the new repo.
2. Copy `scripts/project_automation_config.sh`.
3. Edit only the adapter file first.
4. Adjust project-specific target maps next:
   - `scripts/project_automation_targets.sh`
5. Rename smoke scripts or backend suites only if the new repo uses different commands.

## Why this matters

Without the adapter split, every new project starts as a manual rewrite.

With the adapter split:

- the cache layer carries over
- the timing history layer carries over
- the profile commands carry over
- the hot-loop frontend server lifecycle carries over
- only project layout and target maps need real customization

## Target maps

The adapter split is now two-layered:

- `scripts/project_automation_config.sh`: directory and route assumptions
- `scripts/project_automation_targets.sh`: path-to-surface, path-to-smoke, path-to-test, and path-to-audit rules

That means a new project can usually keep the orchestration scripts and only replace these two adapter files.

That turns this from one-off repo glue into an automation base you can reuse.

## Private repo

Yes, the core can live in a separate private repository.

The easiest path is:

1. run `make export-automation-core`
2. create a new private GitHub repo
3. copy `automation-core-dist/` into that repo
4. evolve the automation core there
5. sync selected changes back into product repos

That gives you a private optimization base while keeping product repos independent.
