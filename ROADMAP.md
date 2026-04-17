# DeployMate Roadmap

Updated: 2026-04-17

This roadmap is written as the current execution order, not as a bag of parallel ideas.

The project is already beyond a UI mock: the live app, release workflow, smoke coverage, admin tooling, and operational docs are real. The roadmap below shows what is intentionally next for the first commercial wedge.

For the longer-lived strategic thesis, ICP, market angle, and signature product hook, see [PRODUCT-STRATEGY.md](PRODUCT-STRATEGY.md).

## Product Direction

DeployMate is being shaped as a Russian-first, self-hosted deployment control layer for agencies, integrators, and outsourced teams that support Docker services on client-owned or self-owned infrastructure.

These teams need:

- an obvious deploy path
- runtime state that is readable in one pass
- handoff without tribal knowledge
- deploy control on infrastructure they or their clients already own
- a path that stays simpler than Kubernetes

The shorter product formula is:

`clear deploy and handoff on infrastructure you already own`

## Long-Lived Product Rule

- Strategic direction should not drift between sessions just because the current chat focused on one local screen.
- The first wedge is ongoing-support teams on client-owned or self-owned infrastructure.
- The product is not aiming for “more controls”; it is aiming for “clearer action” and “safer handoff”.
- The main path must stay understandable in plain language for a person who thinks in terms of:
  - connect server
  - choose what to run
  - deploy it
  - see if service is alive
  - know what to do next
- The compact source of truth for these constraints now lives in [PROJECT-RULES.md](PROJECT-RULES.md) and [PRODUCT-STRATEGY.md](PRODUCT-STRATEGY.md).

## What Is Already True

- the live demo is public at `https://deploymatecloud.ru`
- the repository already shows runtime, admin, backup dry-run, and release automation depth
- `develop` now flows through surface-aware CI and auto-staging
- beginner-clarity work already tightened `/app`, `/app/server-review`, `/app/deployment-workflow`, and deployment detail
- the release path already includes live-host validation, remote audits, and post-deploy smoke

## Current Main Track

For the next 12 weeks, the order is fixed:

1. packaging and message-market fit
2. production baseline
3. stack ceiling removal
4. Passport
5. agency fit and packaging

Important deferral:

- `README.md` and broader repo-root packaging stay deferred until the real public funnel rewrite lands, so docs do not drift ahead of the product.

## 12-Week Execution Order

### Theme 1: Packaging and message-market fit (Weeks 1-4)

- Week 1: ICP, product promise, funnel telemetry, and one internal explanation of the product.
- Week 2: public funnel around the agency wedge, buyer-facing commercial path, and removal of evaluator-heavy emphasis from the first screens.
- Week 3: Russian-first activation, local provider presets, Russian quickstart, and a stronger `overview -> server-review -> deployment-workflow` story.
- Week 4: generic webhook or release source v0 with release metadata and release trace in activity and deployment detail.

### Theme 2: Production baseline (Weeks 5-7)

- Week 5: secrets v1 as a separate object from config vars, with masking, redaction, and audit trail.
- Week 6: domains and SSL v1 as a first-class outcome.
- Week 7: release review and rollback v1 with `previous known good release`.

### Theme 3: Stack ceiling removal (Weeks 8-9)

- Week 8: stack or Compose intake v0: paste or upload, validate, preview, primary service selection, and stack metadata.
- Week 9: stack deploy v0 on one server target, stack health, stack redeploy or delete, and the first real `app + db + worker` scenario.

### Theme 4: Passport (Week 10)

- Week 10: Passport v1 becomes the central runtime surface for both `single` and `stack` runtimes.

### Theme 5: Agency fit and packaging (Weeks 11-12)

- Week 11: client or workspace separation, ownership, handoff note, and team or client templates.
- Week 12: buyer-facing packaging v2, design partner demos, and the pilot onboarding checklist.

## Gate Reviews

### Week 4 gate

- the target ICP understands the product without author narration
- the funnel is measurable
- the first controlled deploy from webhook or release source already exists

### Week 7 gate

- secrets, domains and SSL, and rollback already look production-useful for a pilot
- Passport is not yet centered if the release, domain, or secret story is still incomplete

### Week 9 gate

- a real `app + db + worker` scenario passes on a live host
- stack support is not modeled as a loose set of unrelated single-container deployments

### Week 12 gate

- design partners come for `client infra + handoff clarity`, not only for a feature checklist against Coolify or managed PaaS
- the buyer can explain what the product is for without a guided demo

## Always-On Operating Loop

- 3 ICP conversations per week
- 1 live-host verification per week
- 1 short demo recording per week
- 1 scope review at the end of the week against:
  - first deploy clarity
  - runtime confidence
  - operator handoff
  - self-hosted deploy value

## Deliberate Non-Goals

- turning webhook or release source into a CI platform
- building Kubernetes or Swarm orchestration
- turning stack support into a broad orchestration layer
- widening admin or recovery surfaces before the main wedge is believable
- pretending the product is already enterprise-complete
