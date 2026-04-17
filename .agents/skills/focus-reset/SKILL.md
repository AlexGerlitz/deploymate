---
name: focus-reset
description: Re-anchor on DeployMate's core path when the owner uses `прочисти голову`, `верни фокус`, or `только главное`, or when a task risks drifting into admin, recovery, import, terminal, or architecture vanity work. Do not use for a narrowly scoped bug fix that already has a clear target and scope.
---

## When to use this

Use this skill when you need to reset the thread before planning, coding, or reviewing a product change.

Typical triggers:
- the owner writes `прочисти голову`
- the owner writes `верни фокус`
- the owner writes `только главное`
- the task is phrased broadly and could expand into multiple directions
- the current discussion is drifting toward admin-heavy, recovery-heavy, or architecture-heavy work that does not strengthen the main story

## Read first

Read only what is needed:
1. `PROJECT-RULES.md`
2. `PRODUCT-STRATEGY.md` if the task touches product direction or packaging
3. `HANDOFF.md` if the task depends on current weekly state
4. the directly relevant screen or route only after the reset is complete

Do not start with a broad repo scan.

## What to produce

Return a short Russian reset with five parts in this order:

1. **Текущая цель проекта** — one plain-language sentence.
2. **Главный путь** — restate `server -> deploy -> observe -> next safe action` in plain Russian.
3. **Что в scope сейчас** — 2 to 4 concrete items.
4. **Что вне scope сейчас** — 2 to 4 concrete items.
5. **Следующий лучший узкий шаг** — exactly one highest-value next step.

If the owner asked for a broader direction, challenge it and narrow it.

## Decision rules

- Favor first deploy clarity over depth.
- Favor runtime confidence over admin breadth.
- Favor handoff quality over decorative platform depth.
- If the user is about to work on a secondary surface while the core path is still unclear, say so directly.
- If the task can be expressed as one screen or one workflow, do that.

## Guardrails

- Do not rewrite the roadmap.
- Do not propose parallel tracks.
- Do not introduce Web Terminal into the answer.
- Do not suggest a broad repo cleanup.
- Do not ask for unnecessary clarification when a narrow recommendation is possible.

## Definition of done

This skill is done when the owner can see, in under 20 seconds:
- what the product is trying to become,
- what the next task should strengthen,
- what to ignore for now.
