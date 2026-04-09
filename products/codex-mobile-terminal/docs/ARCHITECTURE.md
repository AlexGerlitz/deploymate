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
- optional VPN bootstrap for private-network terminal access

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

## VPN Wrapper

Production deploys may attach the terminal bridge to a private network before the
PTY runtime starts.

The bridge supports:

- optional bootstrap hook before Node starts
- optional teardown hook on container exit
- dedicated `/vpn` mount for private config and helper scripts
- container capabilities for `/dev/net/tun` and `NET_ADMIN`
