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

To install it and prefill the first adapter config in one shot:

```bash
bash scripts/bootstrap_project_automation.sh /absolute/path/to/project --init-adapters --project-name MyApp --frontend-dir web --backend-dir api
```

Or through `make`:

```bash
make bootstrap-core TARGET_DIR=/absolute/path/to/project
```

Or through `make` with adapter prefill:

```bash
make bootstrap-core-init TARGET_DIR=/absolute/path/to/project BOOTSTRAP_CORE_FLAGS="--project-name MyApp --frontend-dir web --backend-dir api"
```

To upgrade an existing project safely:

```bash
bash scripts/upgrade_project_automation.sh /absolute/path/to/project
```

Or through `make`:

```bash
make upgrade-core TARGET_DIR=/absolute/path/to/project
```

To inspect version, integrity, and drift before upgrading:

```bash
bash scripts/automation_core_doctor.sh /absolute/path/to/project
```

Or through `make`:

```bash
make doctor-core TARGET_DIR=/absolute/path/to/project
```

For shell-friendly automation:

```bash
bash scripts/automation_core_doctor.sh /absolute/path/to/project --format shell
```

The local/project doctor layer is machine-readable too:

```bash
bash scripts/dev_doctor.sh --format shell
bash scripts/pr_doctor.sh --format shell
```

## What stays project-specific

Three adapter files are expected to change first in another project:

- `scripts/project_automation_config.sh`
- `scripts/project_automation_targets.sh`
- `scripts/project_automation_smoke_checks.sh`

Everything else is intended to be the reusable core.

Both the fast auth/ops/runtime smoke layer and the heavier admin/restore/servers/templates smoke layers now read checks from this adapter instead of hardcoding DeployMate page assertions inside the core scripts.

## Fastest First Day In A New Repo

After bootstrap, the shortest useful path is:

```bash
make changed
make profile-changed
make dev-doctor
```

That gives you a cheap first validation, the timing picture, and one summary of what to run next.
