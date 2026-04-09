# Runbook

## Local Dev

Shell 1:

```bash
cd products/codex-mobile-terminal
npm run start:server
```

Shell 2:

```bash
cd products/codex-mobile-terminal
npm run dev:web
```

## Local Docker Dev

```bash
cd products/codex-mobile-terminal/ops
docker compose -f docker-compose.dev.yml up --build
```

The compose file intentionally builds from the project root so both containers use the shared workspace `package-lock.json`.

Web UI:

- `http://localhost:3032`

Bridge:

- `http://localhost:4020/health`

Use `TERMINAL_SERVER_WS_URL` for the websocket bridge in local Docker mode.

## Caution

- do not point the new sidecar at the live terminal domain yet
- keep server-side `.codex` persistence on its dedicated sidecar path
