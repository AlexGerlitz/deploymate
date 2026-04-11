# Beginner Walkthrough

Updated: 2026-04-11

This is the current manual walkthrough for the DeployMate core path.
Use it before rewriting first-pass copy or changing the main beginner screens.

## Goal

- confirm that a first-time admin understands the first click within 10 seconds
- confirm that a member does not see a false Step 2 or Step 3 path before Step 1 is actually complete
- capture one smallest next fix instead of a broad rewrite

## Admin Path

1. Open `/app`.
   Ask: what is this product, what should I do now, and is the primary CTA correct?
   Expected: the page explains the three-step story and points to server setup when no target exists.
2. Open `/app/server-review`.
   Ask: does Step 1 read as one job, and do create/check actions clearly outrank edit/delete controls?
   Expected: save one server, run one check, then move to Step 2.
3. Open `/app/deployment-workflow`.
   Ask: after Step 1, is the next rollout action obvious without scanning jargon-heavy controls?
   Expected: one main next-step card and one clear primary action.
4. If a deployment already exists, open one deployment detail page.
   Ask: does the page answer what is running, whether it is healthy, and what to do next?

## Member Path

Run this in a remote-only setup where server inventory stays admin-managed.

1. Open `/app`.
   Ask: does the page clearly say that Step 1 is still blocked on admin server setup?
   Expected: no false `start deployment` primary CTA before a target exists.
2. Open `/app/server-review`.
   Expected: blocked/admin-managed state only, with no server create or edit controls.
3. Open `/app/deployment-workflow`.
   Expected: blocked/member-safe state until admin Step 1 is complete, or live review only if deployments already exist.
   Existing deployments should read as review-only work, not as a false instruction to wait for admin setup again.

## What To Record

- exact screen
- exact hesitation point or false CTA
- one sentence on why it breaks the main story
- one smallest recommended fix

## Matching Local Guardrail

```bash
npm --prefix frontend run smoke:beginner
npm --prefix frontend run smoke:servers
npm --prefix frontend run smoke:runtime
```

Use `smoke:beginner` for changes to `/app`, `/app/server-review`, or `/app/deployment-workflow`.
