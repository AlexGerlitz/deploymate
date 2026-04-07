# DeployMate Roadmap

This roadmap is written for evaluators as much as for implementation planning.

The project is already beyond a UI mock: the live app, release workflow, smoke
coverage, admin tooling, and operational docs are real. The roadmap below shows
what is intentionally next.

## Product Direction

DeployMate is being shaped as a self-hosted deployment control panel for small
teams that want:

- a runtime surface that is readable in one pass
- admin workflows that feel productized rather than bolted on
- release and recovery discipline around the app, not outside it
- a first-run experience where a non-technical user can still see the obvious next click

## Long-Lived Product Rule

- Strategic direction should not drift between sessions just because the current chat focused on one local screen.
- The product is not aiming for “more controls”; it is aiming for “clearer action”.
- The main path must become understandable in plain language for a person who thinks in terms of:
  - connect server
  - see if service is alive
  - know what to do next
- The compact source of truth for these constraints now lives in [PROJECT-RULES.md](PROJECT-RULES.md).

## What Is Already True

- the live demo is public at `https://deploymatecloud.ru`
- the repository already shows runtime, admin, backup dry-run, and release automation depth
- `develop` now flows through surface-aware CI and auto-staging
- the product story can already be evaluated through the demo, docs, and runbooks

## Current Focus

### 1. Demo-to-product clarity

Make the public evaluation path feel intentional from the first click through the
release story.

Near-term slices:

- keep tightening the reviewer path from login to runtime to admin surfaces
- tighten the newbie path from server connection to “service is healthy / service needs help”
- keep the repo root easy to skim for product, architecture, and release context
- make release milestones legible through docs and public notes

### 2. Runtime confidence

Keep the deployment workflow believable by improving confidence, not by adding
surface area for its own sake.

Near-term slices:

- deepen automated coverage for deployment creation, redeploy, delete, and diagnostics
- keep runtime smoke coverage aligned with the strongest user-visible paths
- preserve clear degraded-mode behavior instead of hiding partial failures
- keep runtime language understandable enough that safety does not depend on expert vocabulary

### 3. Recovery and operator safety

Recovery tooling should become more structured without making destructive flows easy.

Near-term slices:

- keep improving backup/export ergonomics
- evolve restore planning beyond dry-run into more explicit import preparation
- keep destructive restore/apply behind stronger safety boundaries

## Next Technical Priorities

### Release and environment discipline

- preserve the current surface-aware CI and staging flow
- keep GitHub Actions and supporting automation current
- make deploy feedback shorter and clearer for operators

### Security posture

- continue tightening SSH trust and credential handling
- keep production defaults remote-only
- narrow local Docker execution to explicit opt-in use cases only

### Product polish

- keep deployment detail ergonomics strong
- make first-screen calls to action more obvious than secondary controls
- keep the server-connection path and runtime path feeling like one continuous product story
- keep exports, audit, and review flows consistent across admin surfaces
- improve seeded demo readability where it strengthens first-pass evaluation

## Longer-Term Direction

- external secret management
- richer observability and deployment metrics
- clearer multi-environment workflows
- a more structured bridge from restore analysis into safe import orchestration

## Deliberate Non-Goals

- pretending the project is already enterprise-complete
- adding broad platform complexity before clarity and safety justify it
- enabling destructive restore flows before the guardrails are strong enough
