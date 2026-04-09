# Server Bridge

This directory will host the websocket and pty bridge for the terminal runtime.

Current responsibilities:

- session auth validation
- websocket transport
- pty spawn and lifecycle
- tmux attach or create
- resize handling
- helper session status endpoint

Current endpoints:

- `GET /health`
- `GET /api/session`
- `WS /ws`
