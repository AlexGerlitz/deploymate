# DeployMate Product Strategy

Updated: 2026-04-17

## Strategic Thesis

DeployMate should not try to become a general cloud platform, a Kubernetes control plane, or a CI platform running builds on customer infrastructure.

DeployMate should become the clearest way to deploy, operate, and hand off Docker services on infrastructure the team or client already owns:

- self-hosted
- provider-agnostic
- Docker-first
- understandable in one pass
- safe enough for real production use

The product category is:

`self-hosted deployment control layer for teams running Docker services on their own VPS, dedicated servers, or private cloud`

## The Job To Be Done

The main job is still:

1. connect a server
2. choose what to run
3. deploy it
4. see whether it is healthy
5. know the next safe action

The real promise is not only "make deploy possible".

The real promise is:

`make deploy, runtime state, and handoff understandable without SSH archaeology or platform-team overhead`

## Who The Product Is For First

Primary first ICP:

- agencies, integrators, and outsourced teams doing ongoing support on client-owned or self-owned infrastructure
- 5-50 live services supported by a small number of operators
- regular handoff between engineers, shifts, or between agency and client
- teams that already have servers but do not want to become a Kubernetes team

Secondary ICP:

- small product teams running 1-10 services on their own VPS or private cloud
- SMB teams with internal tools and one or two technical operators

These buyers already have servers.
They do not want deployment safety or service context to depend on tribal knowledge.
They do not want to buy a cloud provider just to get deploy clarity and handoff discipline.

## Russia Market Read

Russia is the first market and the first packaging wedge.

The strongest local angle is:

- Russian-language product, onboarding, and operator docs
- works on infrastructure the customer already owns
- provider presets for common Russian VPS and VM shapes
- not tied to one provider
- easier than Kubernetes
- safer and clearer than raw Docker plus SSH

This is relevant because the Russian cloud market is still growing, while provider concentration, security expectations, and infrastructure sovereignty pressures remain high.

Useful market references:

- [Interfax on Russian cloud market growth and iKS-Consulting projections](https://www.interfax.ru/amp/1057573)
- [Timeweb App Platform docs](https://timeweb.cloud/docs/apps/upravlenie-apps-v-paneli)
- [Yandex Cloud Apps overview](https://yandex.cloud/en/services/cloud-apps)
- [Coolify docs](https://coolify.io/docs)
- [Dokploy official site](https://dokploy.com/)

Inference:

There is room for a provider-agnostic control layer above VPS and private infrastructure, especially for ongoing-support teams that want deploy simplicity without handing platform control to a single cloud vendor.

## Competitive Position

DeployMate should not try to beat every competitor on feature count.

That would lose against broader platforms.

DeployMate should win on:

- clarity of the first deploy path
- safe runtime review after deploy
- reusable templates without platform complexity
- operator handoff quality
- self-hosted control on client-owned or self-owned infrastructure

The product should feel closer to:

`clear deploy and handoff on infrastructure you already own`

not to:

`yet another infrastructure dashboard`

## Signature Differentiator

The product-level differentiator should be:

### Deployment Passport

Every deployment should have a human-readable runtime passport that answers, in one place:

- what is running
- where it is running
- which image, template, or release source produced it
- which URL, port, and health path matter
- who owns it
- what changed in the latest release
- what the current risk is
- what the next safe action is
- how to redeploy or roll back safely

When the runtime is degraded, the same surface should switch into incident mode:

- likely cause
- first checks
- safe actions now
- escalation path

This is the best candidate for a real product hook, but it only becomes a moat after the runtime already has:

- release source and release trace
- secret, domain, and rollback context
- a coherent runtime shape (`single` or `stack`)

Before that point, Passport is only a nicer detail view.
After that point, it becomes the operational artifact that explains runtime state and the next safe action.

## Near-Term Execution Order

This order is fixed for the next cycle:

1. packaging and message-market fit
2. webhook/release source
3. secrets
4. domains and SSL
5. release review and rollback
6. stack/Compose ceiling removal
7. deployment passport
8. client/workspaces and ownership
9. commercial packaging

Rules for this order:

- do not center Passport before release, domain, and runtime-shape context are real
- do not treat `single-container-first` as the acceptable long-term ceiling
- do not widen agency-fit surfaces before baseline runtime credibility is real

## Product Plan

### Phase 1: Packaging And First Deploy In 10 Minutes

Goal:

- the right first buyer can understand the product and reach a first healthy service without author help

Required outcomes:

- public messaging speaks to ongoing-support teams on client-owned or self-owned infrastructure
- beginner path is obvious from `/app`
- server setup, deployment workflow, and runtime detail feel like one story
- provider presets exist for common VPS shapes
- the product explains plain-language meanings for `server`, `what to run`, and `healthy`

### Phase 2: Production-Useful Runtime

Goal:

- the first deployed service is actually maintainable and releasable in a real pilot

Required outcomes:

- webhook or release source with traceable release metadata
- environment variable and secret handling
- domains and SSL as first-class flows
- redeploy, rollback, and release review
- better unhealthy-state guidance

### Phase 3: Stack Ceiling Removal

Goal:

- the product stops being strictly single-container-first for the first real multi-service workloads

Required outcomes:

- internal runtime axes exist for `release_source` and `runtime_shape`
- stack or Compose intake exists for a supported v0 subset
- one stack has one primary service, one health target, and one rollback unit
- service inventory is attached to that runtime instead of becoming a loose set of unrelated deployments

### Phase 4: Team And Agency Fit

Goal:

- one operator can hand the service to another without losing context across client work

Required outcomes:

- stronger ownership model
- workspace or client separation
- clearer audit and activity trail
- reusable templates as team assets
- deployment passport and handoff quality become central, not decorative

### Phase 5: Commercial Packaging

Goal:

- the product is easy to buy and easy to justify for the first wedge

Required outcomes:

- clear self-hosted commercial offer
- agency or multi-client packaging
- onboarding and support motion
- Russian-language operator and install materials

## Deliberate Non-Goals

Not now:

- Kubernetes-first orchestration
- broad platform engineering sprawl
- trying to replace a cloud provider
- building a CI platform on customer infrastructure
- building many advanced admin surfaces before the deploy path is excellent
- turning Web Terminal into the center of the product story

## Success Metrics

The strategy is working if:

- a target ICP user can explain the product in under 30 seconds
- first server to first healthy deployment becomes a short, repeatable path
- runtime review answers the next action without reading raw logs first
- ongoing-support teams can manage several client or self-hosted services without SSH-based tribal knowledge
- demos and pilots convert because the product story is obvious, not because the author explains it live

## Strategic Rule

If a proposed feature does not strengthen one of these:

- first deploy clarity
- runtime confidence
- operator handoff
- self-hosted deploy value

then it should not displace current priorities.
