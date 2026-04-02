# Security

## Reporting

If you discover a security issue, please do not open a public issue with exploit details first. Share a concise report privately with:

- affected area
- impact
- reproduction steps
- suggested mitigation, if known

## Current security posture

DeployMate is intentionally positioned as a strong MVP rather than a finished enterprise platform.

Current strengths:

- user passwords are hashed
- restore flow is dry-run only
- admin audit trail exists for important admin actions
- SSH host key checking defaults to `accept-new` instead of `no`
- strict `DEPLOYMATE_SSH_HOST_KEY_CHECKING=yes` now fails fast unless a real non-empty `known_hosts` file is configured
- production can run as remote-only without Docker socket access in the backend
- tracked-file security audit is part of the local preflight flow
- new server targets now require SSH-key authentication
- server credentials are encrypted at rest when stored, and startup now fails fast if credential records exist without `DEPLOYMATE_SERVER_CREDENTIALS_KEY`

Current tradeoffs:

- server credentials are still application-managed
- local Docker control is still available as an opt-in mode in some environments
- local Docker execution and remote SSH orchestration still share one backend boundary

## Hardening direction

Planned improvements include:

1. moving server credentials to external secret management
2. tightening SSH trust from `accept-new` toward pinned known-host workflows
3. splitting Docker execution into a narrower capability boundary
4. increasing automated coverage around runtime deployment paths

## Local audit

Run:

```bash
bash scripts/security_audit.sh
```

This currently checks tracked files for:

- obvious committed token patterns
- private key material
- risky runtime markers such as `StrictHostKeyChecking=no`
- accidental `docker.sock` references
