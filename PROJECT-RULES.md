# DeployMate Project Rules

Updated: 2026-04-11

## Source Of Truth

- Product strategy lives in [PRODUCT-STRATEGY.md](/Users/alexgerlitz/deploymate/PRODUCT-STRATEGY.md).
- This file defines how the project must be built and how work must be executed.
- If a local task or chat direction conflicts with these rules, these rules win.

## Strategic Direction

DeployMate must stay:

- strong
- light
- obvious on first pass

DeployMate is not trying to become:

- a generic cloud platform
- a Kubernetes control plane
- a terminal-centric product
- a broad infrastructure dashboard

DeployMate is trying to become:

`the clearest way to deploy and operate Docker applications on your own servers`

## Main Product Story

The main path is:

1. connect a server
2. choose what to run
3. deploy it
4. see whether it is healthy
5. know the next safe action

If a new feature does not strengthen this path, it is not a priority.

## Strategic Priorities

Current product priorities must always map to one of these:

- first deploy clarity
- runtime confidence
- operator handoff quality
- self-hosted deploy value

If a proposed change does not clearly improve one of these, it should not displace current work.

## Product Boundaries

### What Stays In The Center

- `Servers`
- `Templates`
- `Deployments`
- `Activity`

These are the first objects a new user should understand.

### What Stays Secondary

- admin user management
- upgrade requests
- backup export
- restore dry-run
- import review
- audit-heavy flows

These can exist, but they must not compete with the main deploy path on the first pass.

### Product Separation

- `DeployMate` and `Web Terminal` are separate products.
- `Web Terminal` must not become part of DeployMate's main story.
- Do not mix `DeployMate` product work with `Web Terminal` work in one slice unless there is a live incident or runtime dependency that truly requires it.

## UX Rules

- One screen, one main job.
- The next click must be obvious without documentation.
- Plain language beats operator jargon on first-pass screens.
- The overview page should explain the workspace before it asks the user to interpret system state.
- The overview page should show one explicit `do this now` action before broader depth.
- Do not show a primary action that is known to be blocked.
- The primary CTA must reflect the user's real blocker.
- Server setup should feel like the natural first step when no target exists.
- Deployment creation should feel like the natural next step after server setup.
- Deployment detail should answer:
  - what is running
  - whether it is healthy
  - what to do next
- Advanced controls should appear only when they help the current decision.
- If a full novice cannot explain the first step in 10 seconds, the screen is not ready.

## Engineering Rules

- Keep the backend shape simple: `routes -> services -> db -> schemas`.
- Keep frontend pages focused; move only genuinely shared logic into helpers.
- Prefer explicit code over clever abstractions.
- Do not add new entities without a product reason.
- Do not add new top-level navigation without a strong reason.
- Refactor only when the current shape blocks clarity or correctness.

## Security And Ownership Rules

- No authenticated user may see or mutate another user's runtime data by accident.
- Deployments, templates, activity, notifications, and future runtime artifacts must have explicit ownership rules.
- Remote server targets are privileged infrastructure, not generic shared UI state.
- Until there is a real sharing model for servers, remote server inventory and remote execution stay admin-only.
- Bootstrap credentials must be explicit.
- Remote SSH trust must stay pinned by default.
- Shared mutable state must have an explicit boundary before UI depth is added.

## Release And Production Rules

- Production and staging must fail closed on insecure configuration.
- The baseline production contract is explicit:
  - real `DEPLOYMATE_ADMIN_PASSWORD`
  - shared auth throttling backend
  - strict SSH host key checking
  - persistent `known_hosts`
  - secure cookies on HTTPS
- A release is not done until the real deploy flow is verified on a live host.
- Post-deploy smoke must verify the real product path:
  - login
  - auth/session state
  - backup dry-run
  - runtime create/health/diagnostics/logs/activity/delete
- Smoke must run from a network position that can actually reach the target.
- If a slice changes release or security behavior, rules, handoff, and ops docs must be updated in the same slice.

## Operating Model

### One Main Track

- There must be one main product track at a time.
- The main track today is `DeployMate core path`.
- Do not split focus across unrelated themes just because multiple ideas are available.

### Work In Three Tempos

#### Monthly Tempo

- One strategic theme for roughly 3-4 weeks.
- A monthly theme must be large enough to matter, but narrow enough to guide decisions.
- Current example themes:
  - `first deploy in 10 minutes`
  - `production-useful runtime`
  - `team and agency fit`

#### Weekly Tempo

- One finished package per week.
- A weekly package must have one visible product result.
- A package is too broad if it cannot be described in two or three sentences.

#### Daily Tempo

- One or two related slices per day, not more.
- Daily work must stay inside one coherent problem area.
- Do not mix UX cleanup, infra cleanup, auth experiments, naming cleanup, and sidecar work in one pass unless one issue truly blocks the other.

## Slice Rules

- Start with one visible product problem.
- Read only the files needed for that problem.
- Make the smallest diff that fully solves the problem.
- Close the slice end-to-end:
  - code
  - verification
  - docs or handoff if reality changed
  - push when the checkpoint is real
- Do not leave half-finished product slices unless there is a real blocker.
- If blocked, record the exact blocker instead of broad speculation.
- Do not expand the slice just because nearby improvements are tempting.
- Do not stop at a patch if the user-visible flow is still broken.

## Preferred Execution Order

For normal product work, the default order is:

1. define the exact user-visible problem
2. inspect the smallest relevant code surface
3. implement the narrowest complete fix
4. run the verification that matches the slice
5. update handoff or rules if the project reality changed
6. commit and push when the checkpoint is meaningful

## Release Cadence

- Do not ship every tiny change to production.
- Do not hold too many unrelated changes for one release.
- The default release rhythm should be:
  - one meaningful product package at a time
  - one release pass after a real completed package
- Exception:
  - live production bugs affecting the core path can be released immediately

## Definition Of Done

A slice is done only if:

- the visible product problem is actually resolved
- the next action is clearer than before
- the code still fits the current project shape
- the right verification was actually run
- docs still describe reality
- the checkpoint is understandable by someone reopening the project later

## Hard Anti-Patterns

Do not:

- widen scope because the current context is open
- mix `DeployMate` and `Web Terminal` work casually
- treat terminal tooling as the product center
- add broad platform complexity before the core path is excellent
- keep rewriting copy if the real problem is workflow shape
- keep changing workflow shape if the real problem is missing runtime capability
- leave strategy only in chat instead of repo docs

## Working Rule

The correct default is:

`one main track, one visible problem, one finished slice, one real checkpoint`
