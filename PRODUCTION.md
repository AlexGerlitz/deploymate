# DeployMate Production

1. Copy `.env.production.example` to `.env.production` and set a real domain, admin password, and database password.
2. Point your domain's DNS A record to the VPS.
3. Make sure Docker Engine with Docker Compose is installed on the VPS.
4. Start DeployMate:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

The stack includes:

- `postgres` with persistent data in the `postgres_data` volume
- `backend` running FastAPI on the internal Docker network
- `frontend` running Next.js in production mode
- `proxy` running Caddy on ports `80` and `443`

Notes:

- The backend mounts `/var/run/docker.sock` so local DeployMate deployments can still manage Docker on the VPS host.
- HTTPS is Caddy-ready. With a real public domain on ports `80` and `443`, Caddy can issue certificates automatically.
- Remote server deployments over SSH still require reachable target hosts and valid SSH credentials stored in DeployMate.
