# DeployMate Agent Rules

## Core Story

- Keep the main product story as `server -> deploy -> observe`.
- Keep the fuller runtime story as `server -> deploy -> observe -> next safe action`.
- Prefer first-pass clarity over admin depth, recovery depth, or architecture vanity work.
- Current priorities stay:
  - first deploy clarity
  - runtime confidence
  - operator handoff quality
  - self-hosted deploy value
- Default to the cheapest sufficient path:
  - narrow file reads
  - minimal diffs
  - targeted verification
- Write user-facing replies in Russian unless another language is explicitly requested.
- Keep `DeployMate` and `Web Terminal` separate unless a real runtime dependency forces overlap.

## Operating Rules

- Read [HANDOFF.md](/Users/alexgerlitz/deploymate/HANDOFF.md) before starting a new package.
- Keep work aligned with the fixed execution order already recorded there.
- Prefer one bounded package at a time:
  - one coherent workflow
  - one main product outcome
  - one clear verification pass
- Do not drift into admin, recovery, import, or broad platform work unless it directly blocks the current package.
- One screen or one workflow per slice unless a cross-surface fix is truly required.
- Do not let a blocked primary CTA survive.
- Deployment detail must answer:
  - what is running
  - whether it is healthy
  - what to do next

## Night Shift Loop

When running unattended or on a scheduled wake-up:

1. Reread [HANDOFF.md](/Users/alexgerlitz/deploymate/HANDOFF.md).
2. Identify the current package and the next package in the fixed order.
3. If the current package is already complete, move to the next one without waiting for the owner.
4. Execute one bounded package end-to-end:
   - implement the smallest coherent diff
   - run the narrowest meaningful verification
   - update [HANDOFF.md](/Users/alexgerlitz/deploymate/HANDOFF.md) with what changed and what comes next
5. If time and confidence remain, continue to the next bounded package in the same order.

## Stop Conditions

Stop and report instead of guessing when:

- a risky product decision is required
- missing credentials, infrastructure, or external access block the next safe step
- verification fails in a way that is not safely diagnosable from the local repo/runtime
- the next task would require widening scope beyond the current package boundary

## Verification Standard

- Prefer changed-scope verification first.
- Keep verification proportional to risk.
- Do not skip verification when a package changes runtime behavior, security posture, or release flow.

## Response Contract

- Before every concrete task recommendation or task start, print:
  - `Рекомендованная модель: <full GPT model/version name>`
  - `Рекомендованный reasoning: <level>`
- Then state the next task in one short practical sentence.
- Use the cheapest sufficient execution path.
- If hidden complexity appears, say exactly:
  - `Escalation needed: switch model/reasoning manually.`

## Verification Commands

Use the smallest relevant check.

- Beginner path (`/app`, `/app/server-review`, `/app/deployment-workflow`):
  - `npm --prefix frontend run smoke:beginner`
- Server setup changes:
  - `npm --prefix frontend run smoke:servers`
- Runtime detail / health / diagnostics / activity changes:
  - `npm --prefix frontend run smoke:runtime`
- Frontend fast path:
  - `make frontend`
- Full fast path when the slice crosses frontend and backend:
  - `make fast`

## Repo-Local Skill Routing

Use these repo-local skills when the prompt matches.

- `прочисти голову`, `верни фокус`, `только главное` -> `$focus-reset`
- `прогони новичка` -> `$beginner-pass`
- `режим недели` -> `$weekly-mode`
- `не расползайся` -> `$narrow-slice`
- deployment detail, observability, handoff quality, runtime passport, next safe action -> `$runtime-detail-check`
