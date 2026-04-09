# Handoff

## Current State

This project is the active `Web Terminal` sidecar for remote Codex work from iPhone.

## Immediate Goal

Build MVP V1:

- web auth screen
- reconnectable terminal screen
- mobile toolbar
- Codex launch action
- persistent server-side `.codex`

## Current Decisions

- project name: `Web Terminal`
- target device: iPhone Safari
- client terminal: xterm.js
- backend: Node websocket + pty
- persistent shell: tmux
- Codex onboarding default: API key

## Constraints

- do not build a full IDE
- do not use `ttyd` as the final engine
- do not store secrets in browser storage
- do not depend on localhost OAuth callback flows

## Next Step

Implement real terminal interaction details:

- toolbar actions wired to xterm input
- live websocket attach from browser
- deploy wiring for web + bridge
- persistent server paths
