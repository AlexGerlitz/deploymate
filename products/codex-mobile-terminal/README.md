# Codex Mobile Console

`Codex Mobile Console` is a separate sidecar project for one job: give an iPhone-first remote Codex console on the server.

This is not part of the main DeployMate product flow.
It provides the current `Web Terminal` as a mobile-first console that is easier to read and control from Safari.

## Scope

- mobile-first Codex console UX
- readable DOM output with native browser text selection
- Codex-first workflow
- persistent terminal session
- persistent Codex state on the server
- simple account onboarding
- safe server-side secret handling

## Non-Goals

- not a VS Code clone
- not a desktop-first IDE
- not a generic app dashboard
- not a replacement for the main DeployMate UI
- not a terminal emulator that tries to match macOS exactly on iPhone

## Target Stack

- frontend: Next.js
- console UI: DOM-first reader + input
- advanced terminal UI: xterm.js
- backend bridge: Node + websocket + pty
- session runtime: tmux
- deploy target: sidecar container behind Caddy

## First Milestone

Build a console-first mobile shell with:

- session cookie auth
- readable output stream as normal DOM text
- one obvious input at the bottom
- quick actions for `GPT-5.4`, `API Key`, `Reset`, `Open Terminal`
- reconnectable advanced terminal fallback
- server-side persistent `.codex` directory

Read [PROJECT-RULES.md](/Users/alexgerlitz/deploymate/products/codex-mobile-terminal/PROJECT-RULES.md) first.

## Local Run

1. Copy `.env.example` to `.env.local` for the web app or export the variables in your shell.
2. Start the bridge server:
   - `npm run start:server`
3. Start the web app:
   - `npm run dev:web`

Primary routes:

- `/console` for the main mobile console
- `/terminal` for advanced raw terminal access

Current required variables:

- `WEB_TERMINAL_USERNAME`
- `WEB_TERMINAL_PASSWORD`
- `WEB_TERMINAL_SESSION_SECRET`
- `WEB_TERMINAL_COOKIE_SECURE`
- `TERMINAL_SERVER_HTTP_URL`
- `TERMINAL_SERVER_WS_URL`

Optional production VPN wrapper variables:

- `WEB_TERMINAL_VPN_ENABLE`
- `WEB_TERMINAL_VPN_BOOTSTRAP_SCRIPT`
- `WEB_TERMINAL_VPN_TEARDOWN_SCRIPT`
- `WEB_TERMINAL_VPN_NETWORK_TEST_HOST`

See the Docker-based dev wiring in [ops/docker-compose.dev.yml](/Users/alexgerlitz/deploymate/products/codex-mobile-terminal/ops/docker-compose.dev.yml) and [ops/RUNBOOK.md](/Users/alexgerlitz/deploymate/products/codex-mobile-terminal/ops/RUNBOOK.md).

For production VPN bootstrap, combine the root compose files:

- [docker-compose.prod.yml](/Users/alexgerlitz/deploymate/docker-compose.prod.yml)
- [docker-compose.prod.web-terminal-vpn.yml](/Users/alexgerlitz/deploymate/docker-compose.prod.web-terminal-vpn.yml)

Docker builds use the project-root workspace lockfile, so the Docker build context must stay at the project root.
