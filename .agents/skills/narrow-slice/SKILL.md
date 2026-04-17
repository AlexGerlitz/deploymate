---
name: narrow-slice
description: Keep implementation narrow when the owner writes `не расползайся` or when a task is likely to balloon into a broad refactor, multi-surface redesign, or exploratory repo sweep. Use it before coding or reviewing a change. Do not use when the task already has a single-file or single-bug scope and no drift risk.
---

## When to use this

Use this skill to define the smallest safe slice before touching code.

Typical triggers:
- the owner writes `не расползайся`
- a prompt mentions several screens, systems, or ideas at once
- the likely fix could sprawl across frontend, backend, and docs without necessity
- the current implementation idea includes cleanup, abstraction, and product changes in one pass

## Read first

1. `PROJECT-RULES.md` for execution budget rules
2. the directly relevant files only

Do not start by scanning the whole repo.

## Slice selection rules

Choose one of these units:
- one screen
- one workflow
- one API contract
- one blocked primary CTA
- one trust or security fix that must ship together

Keep the slice small enough that the changed files are obvious before implementation starts.

## What to produce before coding

Return a short Russian preflight with these fields:

- **Выбранный slice**
- **Какие файлы трогаем**
- **Что не трогаем**
- **Минимальное изменение**
- **Чем проверяем**

Then implement only that slice.

## Implementation guardrails

- Prefer direct edits over new abstractions.
- Do not add a new entity or top-level nav item unless the current shape blocks correctness.
- Do not mix DeployMate work with Web Terminal work.
- Do not add cleanup or “while we are here” changes.
- If the slice expands materially, stop and say: `Escalation needed: switch model/reasoning manually.`

## Verification

Use the smallest relevant command.

Examples:
- beginner surfaces: `npm --prefix frontend run smoke:beginner`
- runtime detail: `npm --prefix frontend run smoke:runtime`
- server setup: `npm --prefix frontend run smoke:servers`
- wider frontend slice: `make frontend`
- cross-surface slice: `make fast`

## Definition of done

This skill is done when the change:
- fixes one real blocker,
- leaves adjacent systems untouched,
- has one clear verification step.
