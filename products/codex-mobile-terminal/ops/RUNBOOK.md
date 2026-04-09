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

## Production VPN Wrapper

The bridge container can bootstrap a private-network tunnel before the terminal
runtime starts.

The current production profile may also route bridge traffic through a local HTTP
proxy bridge, for example `172.18.0.1:8118`, using the `WEB_TERMINAL_*_PROXY`
variables from the root VPN override compose file.

Expected production shape:

- use the root override file [docker-compose.prod.web-terminal-vpn.yml](/Users/alexgerlitz/deploymate/docker-compose.prod.web-terminal-vpn.yml)
- mount VPN assets into `/vpn`
- set `WEB_TERMINAL_VPN_ENABLE=1`
- provide an executable `/vpn/bootstrap.sh`
- optionally provide `/vpn/teardown.sh`
- optionally set `WEB_TERMINAL_VPN_NETWORK_TEST_HOST` for a post-bootstrap reachability check
