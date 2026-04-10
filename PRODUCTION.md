# DeployMate Production

1. Copy `.env.production.example` to `.env.production` and set a real domain, admin password, database password, and a stable `DEPLOYMATE_SERVER_CREDENTIALS_KEY`.
2. Point your domain's DNS A record to the VPS.
3. Make sure Docker Engine with Docker Compose is installed on the VPS.
4. Prepare the pinned SSH host key file before the first remote deployment:

```bash
bash scripts/prepare_known_hosts.sh --host <target-host> --port 22 --output /opt/deploymate/.secrets/deploymate_known_hosts
```

5. Validate the production env contract:

```bash
bash scripts/production_env_audit.sh --env-file .env.production --require-runtime-files
```

6. Start DeployMate:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

The stack includes:

- `postgres` with persistent data in the `postgres_data` volume
- `backend` running FastAPI on the internal Docker network
- `frontend` running Next.js in production mode
- `proxy` running Caddy on ports `80` and `443`

Notes:

- Generate `DEPLOYMATE_SERVER_CREDENTIALS_KEY` once and keep it stable for the lifetime of the environment. Example:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

- If the key changes later, previously stored server SSH credentials will no longer decrypt until the original key is restored.
- Production now defaults to a `remote-only` profile. The backend does not need `/var/run/docker.sock` for the standard production setup.
- Keep `NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0` in production so the UI matches the remote-only backend policy and does not offer local host deployment paths.
- Public demo signup can be enabled with `DEPLOYMATE_PUBLIC_SIGNUP_ENABLED=true` and `NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED=1`. New users are created as `member` on the `trial` plan.
- HTTPS is Caddy-ready. With a real public domain on ports `80` and `443`, Caddy can issue certificates automatically.
- DeployMate now refuses silent `admin/admin` bootstrap. Set a real `DEPLOYMATE_ADMIN_PASSWORD`, or acknowledge local-only insecure bootstrap explicitly with `DEPLOYMATE_ALLOW_INSECURE_DEFAULT_ADMIN=true`.
- Remote server deployments over SSH still require reachable target hosts and valid SSH credentials stored in DeployMate.
- SSH host key handling is configurable through `DEPLOYMATE_SSH_HOST_KEY_CHECKING`. The default is now strict pinned verification via `yes`. Use `accept-new` or `no` only as an explicit escape hatch for non-production environments.
- When `DEPLOYMATE_SSH_HOST_KEY_CHECKING=yes`, `DEPLOYMATE_SSH_KNOWN_HOSTS_FILE` must point to an existing non-empty `known_hosts` file or remote SSH actions will fail fast.
- Use `bash scripts/prepare_known_hosts.sh --host <host> --port <port> --output /opt/deploymate/.secrets/deploymate_known_hosts` to populate the pinned `known_hosts` file expected by the production example and compose defaults.
- `docker-compose.prod.yml` now bind-mounts `DEPLOYMATE_SSH_KNOWN_HOSTS_FILE` into the backend container, so the path must exist on the host before the backend starts.
- Run `bash scripts/production_env_audit.sh --env-file .env.production --require-runtime-files` before each production release when you change env, compose, or SSH trust settings.
- Set `DEPLOYMATE_LOCAL_DOCKER_ENABLED=true` only if you intentionally want local-on-host Docker control and have reviewed the extra security tradeoff.
