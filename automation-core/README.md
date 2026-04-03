# Automation Core Bundle

This directory defines the reusable automation bundle that can be exported into a separate repository.

## What to do with it

If you want to keep the automation core private:

1. export the bundle from this repo
2. create a new private GitHub repository
3. copy the exported files there
4. continue evolving the automation core privately
5. pull selected updates back into product repos when needed

## Export command

```bash
make export-automation-core
```

That writes a portable bundle into `automation-core-dist/` by default.

To export somewhere else:

```bash
bash scripts/export_automation_core.sh /absolute/path/to/output
```

To install the core into another project directly:

```bash
bash scripts/bootstrap_project_automation.sh /absolute/path/to/project
```

Or through `make`:

```bash
make bootstrap-core TARGET_DIR=/absolute/path/to/project
```

## What stays project-specific

Two adapter files are expected to change first in another project:

- `scripts/project_automation_config.sh`
- `scripts/project_automation_targets.sh`
- `scripts/project_automation_smoke_checks.sh`

Everything else is intended to be the reusable core.

Both the fast auth/ops/runtime smoke layer and the heavier admin/restore/servers/templates smoke layers now read checks from this adapter instead of hardcoding DeployMate page assertions inside the core scripts.
