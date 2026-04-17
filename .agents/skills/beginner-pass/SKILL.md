---
name: beginner-pass
description: Evaluate the first-time beginner flow when the owner writes `прогони новичка` or when a change touches `/app`, `/app/server-review`, `/app/deployment-workflow`, member gating, first-pass copy, or primary CTAs. Use it to find hesitation points and false primary actions. Do not use for backend-only changes that cannot affect the beginner path.
---

## When to use this

Use this skill for first-pass UX checks on the core DeployMate story.

Typical triggers:
- the owner writes `прогони новичка`
- changes to `frontend/app/app/page.js`
- changes to `frontend/app/app/server-review/page.js`
- changes to `frontend/app/app/deployment-workflow/page.js`
- changes to beginner copy, step cards, empty states, blocked states, or primary CTA logic
- changes that might affect admin vs member behavior in a remote-only setup

## Read first

1. `PROJECT-RULES.md`
2. `docs/beginner-walkthrough.md`
3. only the touched beginner surfaces

Use the walkthrough as the script. Do not invent a different evaluation path unless the code has clearly moved.

## What to check

Run the walkthrough mentally and, when possible, with the existing smoke commands.

### Admin path

Check:
1. `/app`
2. `/app/server-review`
3. `/app/deployment-workflow`
4. one deployment detail page if relevant to the slice

Ask on each step:
- what is this screen for?
- what is the next click?
- is the primary CTA truthful?
- is a blocked action incorrectly promoted?

### Member path

Check the remote-only admin-managed setup.

Ask:
- does the member see a false Step 2 or Step 3 path before admin Step 1 is complete?
- does the member understand whether they can deploy, review, or only wait?
- is live review clearly different from “start a new deploy”?

## Verification commands

Use the smallest relevant set:

```bash
npm --prefix frontend run smoke:beginner
npm --prefix frontend run smoke:servers
npm --prefix frontend run smoke:runtime
```

For changes limited to `/app`, `/app/server-review`, or `/app/deployment-workflow`, start with `smoke:beginner`.

## Output format

Return a short Russian report with one section per issue:

- **Экран**
- **Точка hesitation / ложный CTA**
- **Почему это ломает главный путь**
- **Самое маленькое исправление**
- **Чем проверить после правки**

If there are many issues, rank them and still recommend one smallest next fix first.

## Guardrails

- Do not turn this into a broad redesign.
- Do not rewrite copy everywhere when one CTA or one sentence is the real blocker.
- Do not promote admin depth into the main story.
- Do not let an unavailable step look primary.

## Definition of done

This skill is done when you can clearly answer:
- what the first-time admin should click first,
- what the first-time member should understand first,
- what one smallest fix would reduce confusion the most.
