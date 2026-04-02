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
- production can run as remote-only without Docker socket access in the backend

Current tradeoffs:

- server credentials are still application-managed
- local Docker control is still available as an opt-in mode in some environments
- local Docker execution and remote SSH orchestration still share one backend boundary

## Hardening direction

Planned improvements include:

1. encrypting server credentials at rest or moving them to external secret management
2. tightening SSH trust from `accept-new` toward pinned known-host workflows
3. splitting Docker execution into a narrower capability boundary
4. increasing automated coverage around runtime deployment paths
