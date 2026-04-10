# Automation Core

This repo now separates reusable local automation logic from DeployMate-specific adapter values.

If you want reusable product scaffolding, not just reusable automation, see [PRODUCT-STARTER.md](PRODUCT-STARTER.md).

## Reusable core

These files are the portable part:

- `scripts/audit_cache.sh`
- `scripts/timing_history.sh`
- `scripts/profile_surface.sh`
- `scripts/dev_fast_check.sh`
- `scripts/dev_verify_changed.sh`
- `scripts/preflight.sh`
- `scripts/release_workflow.sh`
- `scripts/production_env_audit.sh`
- `scripts/production_contract_gate.sh`
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

1. Bootstrap the core into the new repo.
2. Prefill adapter config immediately if you already know the project layout.
3. Edit only the adapter file first.
4. Adjust project-specific target maps next:
   - `scripts/project_automation_targets.sh`
5. Adjust project-specific smoke assertions next:
   - `scripts/project_automation_smoke_checks.sh`
6. Rename smoke scripts or backend suites only if the new repo uses different commands.

## First Validation Pass

After the three adapter files are updated, use this order:

1. `make changed`
2. `make profile-changed`
3. `make dev-doctor`
4. `make frontend` or `make backend`
5. `make full`

That keeps the first migration pass cheap and makes the slowest mismatch obvious quickly.

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
- `scripts/project_automation_smoke_checks.sh`: reusable fast and heavy smoke routes and assertions

That means a new project can usually keep the orchestration scripts and only replace these adapter files.

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

## Bootstrap Helper

This repo now includes:

- `scripts/bootstrap_project_automation.sh`
- `scripts/init_project_automation_adapters.sh`
- `scripts/upgrade_project_automation.sh`
- `scripts/automation_core_doctor.sh`
- `scripts/dev_doctor.sh`

It installs the manifest files into another project root, skips existing files by default, and only overwrites them when `--force` is passed explicitly.

For the fastest adoption path in a new repo:

```bash
make bootstrap-core-init TARGET_DIR=/absolute/path/to/project BOOTSTRAP_CORE_FLAGS="--project-name MyApp --frontend-dir web --backend-dir api"
```

That still leaves the target maps and smoke checks for you to adapt, but it removes the most boring first-pass edits.

The upgrade helper is stricter by default:

- reusable core files can be refreshed in place
- adapter files stay untouched unless `--include-adapters` is passed
- changed existing files stay untouched unless `--force` is passed

The doctor helper reports:

- source core version
- target installed version
- reusable-core drift or missing files
- adapter drift separately from core drift
- a readiness status:
  - `ready`
  - `adapters-in-progress`
  - `adapters-unedited`
  - `adapters-missing`
  - `core-needs-sync`

Both doctor layers now also have a machine-readable mode:

- `bash scripts/automation_core_doctor.sh /path/to/project --format shell`
- `bash scripts/dev_doctor.sh --format shell`
- `bash scripts/pr_doctor.sh --format shell`

That matters when you want the next project to automate decisions instead of scraping human text.

## What Is Already Portable

These parts are now explicitly adapter-driven:

- project layout
- path classification
- release surface rules
- frontend fast smoke target rules
- backend test target rules
- security/runtime scope rules
- production env contract audit rules
- CI/manual workflow production contract gate
- frontend smoke assertions for auth, ops, runtime, admin, admin-interactions, restore, servers, and templates
