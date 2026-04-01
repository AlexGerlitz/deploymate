# DeployMate VPS Runbook

Path on server:

```bash
/opt/deploymate
```

SSH entry:

```bash
ssh deploymate
```

## 1. Fast checks

```bash
ssh deploymate
cd /opt/deploymate
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=50 proxy
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=50 backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=50 frontend
curl -I https://deploymatecloud.ru
curl -I https://deploymatecloud.ru/app
```

## 2. Update From `develop`

```bash
ssh deploymate
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
```

## 3. Frontend-only deploy

```bash
ssh deploymate
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps frontend
docker compose -f docker-compose.prod.yml --env-file .env.production ps frontend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 frontend
curl -I https://deploymatecloud.ru/app
```

### Frontend change flow

Local machine:

```bash
cd ~/deploymate
git switch develop
npm --prefix frontend run build
git status --short
git add frontend/app/app/page.js
git commit -m "Describe the frontend change"
git push origin develop
```

VPS:

```bash
ssh deploymate
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps frontend
docker compose -f docker-compose.prod.yml --env-file .env.production ps frontend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 frontend
curl -I https://deploymatecloud.ru/app
```

Quick rollback for a bad frontend-only deploy:

```bash
ssh deploymate
cd /opt/deploymate
git log --oneline -n 5
git switch develop
git reset --hard <previous_commit_sha>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps frontend
curl -I https://deploymatecloud.ru/app
```

## 4. Backend-only deploy

```bash
ssh deploymate
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps backend
docker compose -f docker-compose.prod.yml --env-file .env.production ps backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 backend
curl -I https://deploymatecloud.ru/api/health
```

### Backend change flow

Local machine:

```bash
cd ~/deploymate
git switch develop
python3 -m py_compile backend/app/main.py backend/app/routes/*.py backend/app/services/*.py backend/app/db.py backend/app/schemas.py
git status --short
git add backend/app
git commit -m "Describe the backend change"
git push origin develop
```

VPS:

```bash
ssh deploymate
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps backend
docker compose -f docker-compose.prod.yml --env-file .env.production ps backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 backend
curl -I https://deploymatecloud.ru/api/health
```

Quick rollback for a bad backend-only deploy:

```bash
ssh deploymate
cd /opt/deploymate
git log --oneline -n 5
git switch develop
git reset --hard <previous_commit_sha>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 backend
curl -I https://deploymatecloud.ru/api/health
```

## 5. Full stack update

```bash
ssh deploymate
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 proxy
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 frontend
curl -I https://deploymatecloud.ru
curl -I https://deploymatecloud.ru/app
```

### Full release flow

Local machine:

```bash
cd ~/deploymate
git switch develop
git pull --ff-only origin develop

# frontend checks when frontend changed
npm --prefix frontend run build

# backend checks when backend changed
python3 -m py_compile backend/app/main.py backend/app/routes/*.py backend/app/services/*.py backend/app/db.py backend/app/schemas.py

git status --short
git add .
git commit -m "Describe the release change"
git push origin develop
```

VPS:

```bash
ssh deploymate
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 proxy
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 frontend
curl -I https://deploymatecloud.ru
curl -I https://deploymatecloud.ru/app
curl -I https://deploymatecloud.ru/api/health
```

Post-deploy smoke check:

```bash
# 1. open /login
# 2. sign in as admin
# 3. open /app
# 4. check Servers block
# 5. check Notifications / Activity history block
# 6. create a test deployment on a free external port
# 7. open deployment details
# 8. check logs / health / activity
# 9. delete the test deployment
```

## 6. Rollback

Check recent history:

```bash
ssh deploymate
cd /opt/deploymate
git log --oneline -n 10
```

Rollback to a specific commit:

```bash
ssh deploymate
cd /opt/deploymate
git switch develop
git reset --hard <commit_sha>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 frontend
curl -I https://deploymatecloud.ru
curl -I https://deploymatecloud.ru/app
```

## 7. Notes

- Do not edit files directly on live production unless the app is already broken and you are restoring service.
- Prefer: local fix -> test -> commit -> push `develop` -> deploy from Git on VPS.
- On `main-vps`, port `80` is already occupied by DeployMate itself. App deployments should use other external ports such as `8080`, `8081`, and above.
- For `frontend-only` and `backend-only` deploys, use `--no-deps` so Compose does not recreate dependent services unnecessarily.

## 8. Emergency restore

If production is broken and you need the shortest path back:

```bash
ssh deploymate
cd /opt/deploymate
docker compose -f docker-compose.prod.yml --env-file .env.production ps
git log --oneline -n 5
git switch develop
git reset --hard <last_known_good_commit>
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 proxy
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 backend
docker compose -f docker-compose.prod.yml --env-file .env.production logs --tail=100 frontend
curl -I https://deploymatecloud.ru
curl -I https://deploymatecloud.ru/app
curl -I https://deploymatecloud.ru/api/health
```
