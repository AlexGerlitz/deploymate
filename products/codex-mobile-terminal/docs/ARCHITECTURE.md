# Architecture

## Overview

The system has three layers:

- web client
- terminal bridge server
- persistent shell runtime

## Web Client

The client is a mobile-first web app that renders:

- login screen
- terminal screen
- mobile control bar

The terminal itself is rendered with xterm.js.

## Terminal Bridge

The server owns:

- session auth
- websocket connections
- PTY lifecycle
- tmux attach or create
- resize events
- safe helper actions

The browser never talks to tmux or shell processes directly.

## Session Runtime

Each terminal session attaches to a named tmux session.

That gives:

- reconnect support
- state continuity
- low-complexity persistence

## Persistent Data

Planned server-side paths:

- terminal sessions
- `.codex`
- uploads
- app config

Exact paths will be fixed during deploy wiring.
