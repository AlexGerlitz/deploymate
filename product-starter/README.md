# Product Starter Bundle

This bundle is for the next project where you want to move fast without starting from a blank repo.

It is not just a docs template.

It includes:

- frontend app shell
- login/register shell
- backend API shell
- starter docs
- automation-core bootstrap path

## Fast install

```bash
bash scripts/bootstrap_product_starter.sh /absolute/path/to/project \
  --project-name MyApp \
  --app-slug myapp \
  --contact-email founder@example.com \
  --frontend-dir web \
  --backend-dir api
```

## What to edit first

1. `README.md`
2. `docs/PRODUCT-BRIEF.md`
3. `frontend/app/page.js` or equivalent frontend directory
4. `backend/app/routes/*` or equivalent backend directory
5. automation adapters:
   - `scripts/project_automation_config.sh`
   - `scripts/project_automation_targets.sh`
   - `scripts/project_automation_smoke_checks.sh`

## First useful commands

```bash
make changed
make profile-changed
make dev-doctor
```
