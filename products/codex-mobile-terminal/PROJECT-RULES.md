# Project Rules

Updated: 2026-04-07

## Product Rule

This project builds one thing only:

- a mobile-first remote terminal for continuing Codex work from iPhone

If a feature does not directly improve that flow, it should be cut or deferred.

## UX Rule

The primary device is iPhone in Safari.

Every decision should favor:

- fast load
- reliable reconnect
- easy tapping
- easy paste
- easy link opening
- minimal UI clutter

Desktop polish is secondary.

## Scope Rule

The core workflow is:

1. open the terminal URL
2. sign in once to the web app
3. reconnect to the saved session
4. start or resume `codex`

Do not expand this into a general-purpose cloud IDE in the first versions.

## Architecture Rule

Do not use `ttyd` as the long-term terminal engine.

Use:

- xterm.js for the client terminal
- a dedicated backend pty bridge
- tmux for persistent shell sessions

## Security Rule

Secrets must stay server-side.

Do not expose:

- API keys
- Codex auth state
- raw secret values

to client-side JavaScript or browser storage.

## Persistence Rule

The following must survive container restarts:

- terminal session
- Codex state
- account configuration

## Simplicity Rule

Prefer one obvious flow over several flexible flows.

First versions should optimize for:

- one user
- one terminal
- one Codex-first workflow

## Delivery Rule

Ship in narrow vertical slices:

1. auth shell
2. terminal shell
3. Codex launch
4. persistence
5. mobile polish

Do not start multiple broad subsystems in parallel.
