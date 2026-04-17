---
name: weekly-mode
description: Turn `режим недели` into a strict weekly focus decision. Use when the owner needs prioritization, a one-week target, backlog cuts, or a sanity check against drift. Do not use for a single implementation task that already has a fixed narrow scope.
---

## When to use this

Use this skill when multiple good ideas are competing and the repo needs one weekly target.

Typical triggers:
- the owner writes `режим недели`
- the owner asks what to do this week
- the discussion is splitting into several product themes
- the team needs a one-week goal, allowed slices, and rejected expansions

## Read first

1. `PROJECT-RULES.md`
2. `HANDOFF.md`
3. `PRODUCT-STRATEGY.md` only if the choice is strategic rather than operational
4. `ROADMAP.md` only if it helps resolve sequencing, not to reopen everything

## What to produce

Return a short Russian weekly brief with these sections:

1. **Тема недели** — one line.
2. **Почему именно она** — one short paragraph tied to the core priorities.
3. **Один результат недели** — one concrete visible outcome.
4. **Разрешенные slice’ы** — up to 3 narrowly related tasks.
5. **Что сознательно не делаем** — up to 5 cuts.
6. **Проверка недели** — one KPI or one observable success check.

## Decision rules

- One weekly theme only.
- Prefer the theme that most strengthens first deploy clarity or runtime confidence.
- Choose a theme that can end in one visible, testable result.
- Reject category drift even when the alternative ideas are attractive.
- If the current handoff suggests unfinished baseline work, do not jump to a more decorative layer.

## Good weekly targets

Good examples:
- clarify `/app` and first CTA truthfulness
- finish one production-baseline gap such as webhook deploy or domains/SSL
- make deployment detail answer the next safe action more reliably

Bad examples:
- “improve everything around admin”
- “do platform polish across the repo”
- “start a second product track in parallel”

## Guardrails

- Do not output a month-long roadmap unless explicitly asked.
- Do not let the weekly brief expand into architecture debates.
- Do not give 5 equal priorities.
- Do not choose work that cannot be verified this week.

## Definition of done

This skill is done when the owner can say:
- what matters this week,
- what is intentionally deferred,
- how to tell whether the week landed.
