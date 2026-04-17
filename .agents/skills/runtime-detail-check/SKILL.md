---
name: runtime-detail-check
description: Review deployment detail, observability, and handoff surfaces when a task touches health, diagnostics, logs, activity, runtime summary, redeploy review, delete review, or the future Deployment Passport. Use it to enforce the rule that deployment detail must answer what is running, whether it is healthy, and what to do next. Do not use for beginner surfaces that do not touch runtime detail.
---

## When to use this

Use this skill for runtime review surfaces, especially:
- `frontend/app/deployments/[deploymentId]/page.js`
- `backend/app/routes/deployment_observability.py`
- `backend/app/services/deployment_observability.py`
- supporting runtime helpers such as `frontend/app/lib/runtime-workspace-utils.js`

Typical triggers:
- deployment detail copy or layout changes
- changes to health, logs, diagnostics, or activity
- handoff or plain-language summary work
- redeploy review, delete review, or next-action guidance
- work related to the future Deployment Passport

## Read first

1. `PROJECT-RULES.md`
2. `PRODUCT-STRATEGY.md` section **Deployment Passport**
3. the touched runtime detail files only

## Core test

The runtime surface must answer these three questions quickly:
1. **Что запущено**
2. **Здорово ли это**
3. **Что делать дальше безопасно**

If a user needs raw logs before they can answer those three, the surface is not ready.

## What to inspect

Check for these layers in order:

### 1. Runtime summary
- Is the active deployment easy to identify?
- Are image, target, URL/port, and ownership understandable?
- Is the main current state visible without opening secondary panels?

### 2. Health and risk
- Is the health signal visible and believable?
- Does the page distinguish healthy, degraded, and blocked states?
- Is the current risk phrased in plain language?

### 3. Next safe action
- Does the page recommend one obvious next action?
- Are dangerous actions demoted until the user has enough context?
- Does a blocked or risky state explain the first safe move?

### 4. Diagnostics and logs
- Do diagnostics confirm the state rather than replace the summary?
- Are logs secondary to diagnosis, not the first screen?
- Does activity help close the loop after health and diagnostics?

### 5. Handoff quality
- Could a second operator understand the situation without SSH archaeology?
- Is there a plain-language summary or equivalent handoff surface?
- Are next checks, likely cause, or escalation path discoverable when degraded?

## Output format

Return a short Russian review in this order:

1. **Что страница уже объясняет хорошо**
2. **Где ломается одно из трех главных вопросов**
3. **Какой следующий safe action сейчас видит пользователь**
4. **Одна самая сильная недостающая вещь**
5. **Самая маленькая правка с наибольшим эффектом**

## Verification

Start with:

```bash
npm --prefix frontend run smoke:runtime
```

If the slice changes API shape or backend behavior, use `make fast` after the focused smoke.

## Guardrails

- Do not turn deployment detail into a broad infrastructure dashboard.
- Do not make logs the first answer.
- Do not flood the page with secondary controls.
- Do not introduce Passport language unless the surface actually earns it.

## Definition of done

This skill is done when a new operator can open deployment detail and quickly explain:
- what is live,
- whether it is okay,
- what safe action comes next.
