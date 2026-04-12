# Codex Protocol

Updated: 2026-04-12

This file defines the short commands the project owner can use to resync Codex without writing long prompts.

## Default Assumption

If the owner uses one of the commands below, Codex should:

- reread [PROJECT-RULES.md](PROJECT-RULES.md)
- keep the main story as `server -> deploy -> observe`
- avoid drifting into admin, recovery, import, or architecture vanity work unless asked directly
- respond with a short practical restatement of the current focus before doing work
- write responses to the owner in Russian unless another language is explicitly requested
- before every task recommendation or task start, print:
  `Рекомендованная модель: <full GPT model/version name>`
  `Рекомендованный reasoning: <level>`
- choose that recommendation only after analyzing the concrete task
- do not print that header in filler messages that do not start or propose a concrete task
- before every new task, print that header first and do not begin the task until the owner has been shown the chosen model and reasoning
- if several small tasks fit the same recommended model and reasoning, batch them into one narrow work package
- only split them when scope, files, risk, or recommended model/reasoning materially differ
- if task execution reveals that a stronger or weaker reasoning level is needed, pause and tell the owner which reasoning level to switch to before continuing
- apply the `Execution Budget Rules` from [PROJECT-RULES.md](PROJECT-RULES.md) strictly
- default to the cheapest sufficient approach
- if hidden complexity appears, say exactly: `Escalation needed: switch model/reasoning manually.`

## Short Commands

### `прочисти голову`

Meaning:
- stop local drift
- restate the current project goal in plain language
- restate the current main path
- list what is in scope and what is out of scope for the next task

### `верни фокус`

Meaning:
- re-anchor on the main product story
- ignore secondary layers unless they directly block the core path
- propose the next highest-value step for clarity

### `прогони новичка`

Meaning:
- reread [PROJECT-RULES.md](PROJECT-RULES.md) and [docs/beginner-walkthrough.md](docs/beginner-walkthrough.md)
- evaluate the first-time admin path: `/app -> /app/server-review -> /app/deployment-workflow`
- evaluate the member path in an admin-managed remote-only setup
- report hesitation points, false primary CTAs, and one smallest recommended fix

### `режим недели`

Meaning:
- reread the 30-day plan in [PROJECT-RULES.md](PROJECT-RULES.md)
- identify the current weekly block
- state one concrete target for this week
- reject unrelated expansion

### `не расползайся`

Meaning:
- keep the task narrow
- prefer one screen or one workflow
- avoid touching unrelated files or systems

### `только главное`

Meaning:
- optimize for first-pass clarity
- remove or demote secondary controls
- prefer obvious next actions over feature depth

### `жесткий коуч`

Meaning:
- answer directly
- challenge weak product decisions
- recommend cuts before additions
- evaluate work by clarity, not by feature count

## Preferred Task Format

For best results, the owner should keep task prompts short and structured:

1. target
2. scope
3. non-goals
4. success check

Example:

```text
прочисти голову
Цель: упростить /app/server-review
Scope: только frontend screen and copy
Non-goals: backend, admin, recovery
Success: новичок понимает create -> test -> deploy path
```

## Codex Guardrails

When the owner uses a short command, Codex should not:

- start broad repo-wide rewrites
- propose multiple parallel product directions
- promote advanced admin flows into the main story
- keep decorative or low-value complexity just because it already exists

## Source Of Truth

Product direction:
- [PROJECT-RULES.md](PROJECT-RULES.md)

Current state and near-term handoff:
- [HANDOFF.md](HANDOFF.md)
