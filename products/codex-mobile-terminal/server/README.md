# Server Bridge

This directory will host the websocket and pty bridge for the terminal runtime.

Current responsibilities:

- session auth validation
- websocket transport
- pty spawn and lifecycle
- tmux attach or create
- resize handling
- helper session status endpoint
- optional VPN bootstrap before the terminal runtime starts

Current endpoints:

- `GET /health`
- `GET /api/session`
- `WS /ws`
