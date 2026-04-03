# Product Starter

This repository now carries two different reusable layers:

- `automation core`: fast local verification, PR flow, reusable release discipline
- `product starter`: a starter product skeleton for the next SaaS or internal tool

The goal of the starter is simple:

- stop starting from an empty repo
- stop rebuilding the same auth/landing/app-shell/admin/docs baseline
- get to product work faster

## What the starter includes

- landing page skeleton
- login and register page skeletons
- app shell/dashboard skeleton
- shared frontend layout and base styles
- backend FastAPI app skeleton
- health, auth, and admin route skeletons
- backend service and schema baseline
- starter docs:
  - `README.md`
  - `docs/PRODUCT-BRIEF.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ROADMAP.md`
- optional automation core bootstrap during starter install

## Fastest path

For a new project:

```bash
make bootstrap-product-starter TARGET_DIR=/absolute/path/to/project PRODUCT_STARTER_FLAGS="--project-name MyApp --app-slug myapp --contact-email founder@example.com --frontend-dir web --backend-dir api"
```

That gives you:

- a starter product structure
- docs placeholders
- app/auth/admin skeleton pages
- backend starter routes and services
- automation core installed into the same target repo

## Why this matters

The automation core makes coding and shipping faster.

The product starter makes **starting the next project** faster.

Together they remove both big buckets of waste:

1. rebuilding dev/release mechanics
2. rebuilding the same starter product shell
