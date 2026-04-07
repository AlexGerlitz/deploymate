# DeployMate Project Rules

Updated: 2026-04-07

## Core Goal

DeployMate must stay:

- strong
- light
- obvious on first pass

The project is not allowed to grow by adding random surface area.
It must grow by making the main path clearer and more reliable.
Short Codex resync commands live in [CODEX-PROTOCOL.md](CODEX-PROTOCOL.md).

## Main Product Story

The product is about one primary flow:

1. connect a server
2. choose a template or image
3. deploy a service
4. see health, logs, and status
5. redeploy or remove if needed

If a new feature does not make this flow better, it is not a priority.

## Product Rules

- One product, one main story.
- One screen, one main job.
- The next click must be obvious without documentation.
- Plain language beats operator jargon on first-pass screens.
- Depth is allowed only after the basic path is already clear.
- Finish one strong workflow before expanding sideways.
- Delete, hide, or postpone anything that weakens clarity.

## What Stays In The Center

- `Servers`
- `Templates`
- `Deployments`
- `Activity`

These are the core objects a new user should understand first.

## What Moves To The Second Layer

- admin user management
- upgrade requests
- backup export
- restore dry-run
- import review
- audit-heavy flows

These can stay in the product, but they must not compete with the main deploy path on the first pass.

## UX Rules

- The overview page should explain the workspace, not try to do everything.
- The overview page should explain the product itself before it explains the workspace.
- Server setup should feel like the natural first step when no target exists.
- Deployment creation should feel like the natural next step after server setup.
- Deployment detail should answer: what is running, is it healthy, and what should I do next.
- Advanced controls should be visible only when they help the current decision.
- If a full novice cannot explain the first step in 10 seconds, the screen is not ready.

## Engineering Rules

- Keep the current simple backend shape: `routes -> services -> db -> schemas`.
- Keep frontend pages focused and move shared logic into small helpers.
- Prefer explicit code over clever abstractions.
- Do not add new entities without a product reason.
- Do not add new top-level navigation without a very strong reason.
- Refactor when a file stops matching the product story.

## Build Discipline

- One weekly goal.
- One finished slice.
- No parallel expansion into multiple product directions.
- No architecture rewrite unless the current shape blocks the main path.
- No feature enters the roadmap unless it can be explained in two sentences.

## Definition Of Done

A slice is done only if:

- a new person can understand what changed quickly
- the main next action is clearer than before
- the code still fits the existing project shape
- the docs still describe reality
- the verification needed for that slice was actually run

## 30-Day Plan

### Days 1-7: Tighten The Core Story

Goal:
- make the project understandable in one minute

Required outputs:
- keep only 4 primary product surfaces: `Overview`, `Servers`, `Deployments`, `Templates`
- define one sentence for each surface
- remove or visually demote anything on first-pass screens that competes with the deploy path
- make sure `/app` clearly sends the user either to server setup or deployment workflow

Success check:
- a new user knows the first click and second click without guessing

### Days 8-14: Make The Product Understandable To A Beginner

Goal:
- make the first-time story understandable without author help

Required outputs:
- rewrite `/app` so it explains what the product does, what step comes first, and what happens after that
- simplify `server-review` so it reads like `Step 1: connect and verify a server`
- simplify `deployment-workflow` so it reads like `Step 2: choose what to run and deploy it`
- remove or demote operator-heavy language that confuses a first-time user

Success check:
- a new user can explain the first two steps without outside help

### Days 15-21: Polish Deployment Clarity

Goal:
- make runtime state readable in one pass

Required outputs:
- tighten deployment workflow around create, live list, and status
- keep detail pages focused on health, logs, activity, and next actions
- reduce low-value text and duplicated UI blocks
- make failed-state guidance more obvious than secondary export tooling

Success check:
- user can instantly tell whether a deployment is healthy and what action comes next

### Days 22-30: Push Admin And Recovery Deeper

Goal:
- keep advanced depth without letting it dominate the product story

Required outputs:
- treat admin and recovery as advanced layers, not the center of the app
- check navigation, entry points, and copy so these flows do not interrupt the core story
- keep docs aligned with the simplified product framing
- only keep advanced controls visible where they are necessary

Success check:
- the project still looks powerful, but first-time understanding stays easy

## Weekly Coaching Loop

Every week:

1. choose one narrow product problem
2. define one visible result
3. cut unrelated work
4. finish the slice
5. ask: did the project become easier to understand?

If the answer is no, the slice was not strong enough.
