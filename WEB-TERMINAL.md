# Web Terminal Rules

Updated: 2026-04-08

## Name

This sidecar tool should be referred to as `Web Terminal`.

Do not call it a lab shell, tty helper, or generic terminal when documenting it.
Use one stable name so it is easy to search locally and on the server.

## Purpose

`Web Terminal` is a separate operator workspace for live work inside the server-side repo checkout.

It is not part of the main DeployMate product story.
It is a maintenance tool for working with Codex, tmux, git, and the checked-out repo on the server.

## Current Server Location

- host alias: `deploymate`
- host: `103.88.241.103`
- main app repo: `/opt/deploymate`
- codex state dir: `/opt/codex-mobile-terminal-data/root-dot-codex`
- sidecar project path in repo: `/opt/deploymate/products/codex-mobile-terminal`

## Runtime Shape

- public entry: `https://lab.deploymatecloud.ru`
- reverse proxy: Caddy
- auth: app password + session cookie
- current live web service: `codex-mobile-terminal-web`
- current live bridge service: `codex-mobile-terminal-server`
- current live product shape: `Codex Mobile Console` as the main screen, raw terminal as advanced mode
- current live runtime: DOM-first console + `xterm.js` fallback + websocket bridge + `tmux`
- production network wrapper: optional VPN bootstrap inside the bridge container before PTY startup
- terminal session: `tmux new-session -A -s codex-mobile`
- mounted workspace inside container: `/workspace` -> `/opt/deploymate`
- persistent Codex auth dir on server: `/opt/codex-mobile-terminal-data/root-dot-codex`
- optional VPN assets dir on server: `/opt/codex-mobile-terminal-data/vpn`
- reproducible local build config: [products/codex-mobile-terminal](/Users/alexgerlitz/deploymate/products/codex-mobile-terminal)
- optional prod VPN override: [docker-compose.prod.web-terminal-vpn.yml](/Users/alexgerlitz/deploymate/docker-compose.prod.web-terminal-vpn.yml)

## iPhone Profile

The current target device is iPhone first.

- use a DOM-first console as the main reading and input surface
- keep raw `xterm.js` available only as advanced mode
- keep websocket reconnect straightforward
- keep shell hints and aliases short enough to be useful on a narrow screen
- keep tmux minimal and hide the status bar to preserve vertical space
- keep one short Codex alias: `c`

## Current UX Shape

The primary route is now:

- `https://lab.deploymatecloud.ru/console`

That route should be treated as the default product surface:

- readable output as normal DOM text
- easier link opening and text selection on iPhone
- one main bottom input
- quick actions for `GPT-5.4`, `API Key`, `Codex`, `Reset`

The raw fallback route remains:

- `https://lab.deploymatecloud.ru/terminal`

Use that only for:

- shell-heavy work
- tmux / vim / git workflows
- cases where a real terminal is still necessary

## Codex Auth In Web Terminal

Why browser auth fails here:

- the web terminal runs on a remote server, not on the iPhone itself
- browser OAuth for Codex uses a localhost callback listener
- `localhost` in that flow points at the remote terminal session, not the mobile browser
- on iPhone inside this remote setup, the browser cannot complete the callback back into that local listener path reliably

Rules for this environment:

- do not treat browser login with localhost callback as the default path
- prefer device-code login for remote or web-terminal sessions
- tell the user: `Press Esc and choose "Sign in with Device Code"`
- keep API-key auth documented as fallback:
  - `printenv OPENAI_API_KEY | codex login --with-api-key`

Two separate sign-ins may still exist:

- web-app password sign-in to `lab.deploymatecloud.ru`
- `Codex` sign-in inside the terminal

Persistence rules:

- web-app password is handled by a session cookie
- `Codex` auth should persist on the server by mounting `/root/.codex` from `/opt/codex-mobile-terminal-data/root-dot-codex`

Current implementation in this stack:

- `/usr/local/bin/codex` is a wrapper for the packaged Codex launcher
- in `CODEX_WEB_TERMINAL=1` sessions, plain `codex login` is redirected to `codex login --device-auth`
- when unauthenticated user opens plain `codex`, the wrapper prints a short remote-auth hint before launch
- if `auth.openai.com` rejects device-code auth for the server region with `unsupported_country_region_territory`, the wrapper fails fast and tells the user to use API-key auth instead

## Fast Find Rules

If you need to find `Web Terminal` again, check these in order:

1. this file: [WEB-TERMINAL.md](/Users/alexgerlitz/deploymate/WEB-TERMINAL.md)
2. server Caddy config in `/opt/deploymate/deploy/Caddyfile`
3. running containers `codex-mobile-terminal-web` and `codex-mobile-terminal-server`
4. sidecar source folder in `/opt/deploymate/products/codex-mobile-terminal`

## Maintenance Rules

- keep `Web Terminal` documented as a separate sidecar service
- keep the public hostname and local server paths written down together
- keep the running service names written down exactly
- if runtime changes, update this file immediately
- if domain, auth, or workspace path changes, update both the local repo copy and the server copy
- prefer one stable tmux session name: `codex-mobile`

## Server Sync Rule

The server should also contain a copy of this document at:

- `/opt/deploymate/WEB-TERMINAL.md`
- `/opt/WEB-TERMINAL-LOCATION.txt`

If those files drift, the repo copy in this project should be treated as the source to refresh them.
