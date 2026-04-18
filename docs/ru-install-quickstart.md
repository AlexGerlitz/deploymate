# Быстрый self-hosted запуск DeployMate

Updated: 2026-04-18

Этот документ нужен для первого живого запуска на своей инфраструктуре или на инфраструктуре клиента.
Цель простая: поднять DeployMate, зайти в интерфейс и пройти первый нормальный маршрут `server -> deploy -> observe`.

## Для кого

- агентства и интеграторы, которые ведут Docker-сервисы клиентов
- небольшие продуктовые команды со своей VPS, dedicated или private cloud инфраструктурой
- support-команды, которым нужен понятный handoff, а не только SSH-доступ

## Что подготовить заранее

- один Linux-хост с публичным IP
- домен, который смотрит на этот хост
- установленный `Docker Engine` и `Docker Compose`
- SSH-доступ к хосту
- отдельные значения для `DEPLOYMATE_ADMIN_PASSWORD`, `POSTGRES_PASSWORD` и `DEPLOYMATE_SERVER_CREDENTIALS_KEY`

## 1. Подготовить репозиторий и production env

```bash
git clone https://github.com/AlexGerlitz/deploymate.git /opt/deploymate
cd /opt/deploymate
cp .env.production.example .env.production
```

Что важно выставить в `.env.production` сразу:

- реальный домен
- сильный `DEPLOYMATE_ADMIN_PASSWORD`
- сильный `POSTGRES_PASSWORD`
- стабильный `DEPLOYMATE_SERVER_CREDENTIALS_KEY`
- `NEXT_PUBLIC_LOCAL_DEPLOYMENTS_ENABLED=0`, если хочешь держать production в remote-only режиме

## 2. Зафиксировать SSH trust до первого remote deploy

```bash
bash scripts/prepare_known_hosts.sh --host <target-host> --port 22 --output /opt/deploymate/.secrets/deploymate_known_hosts
```

Это важная часть production-контура: remote SSH actions не должны жить на `accept-new` по умолчанию.

## 3. Проверить production env contract

```bash
bash scripts/production_env_audit.sh --env-file .env.production --require-runtime-files
```

Если этот шаг падает, не переходи дальше. Сначала почини env и runtime file path-ы.

## 4. Поднять production stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Ожидаемый базовый состав:

- `postgres`
- `backend`
- `frontend`
- `proxy`

## 5. Проверить, что инстанс действительно жив

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
curl -I https://your-domain
curl -I https://your-domain/app
curl -I https://your-domain/api/health
```

Если домен и HTTPS ещё не готовы, сначала добей DNS и Caddy-ready доступ на `80/443`.

## 6. Первый операторский проход после запуска

1. Зайди в DeployMate под админом.
2. Открой `/app/server-review`.
3. Сохрани один серверный target и прогони connection check.
4. Перейди в `/app/deployment-workflow`.
5. Выкати один образ или один stack.
6. Открой deployment detail и проверь `Deployment passport`.

На этом этапе интерфейс уже должен отвечать на три вопроса:

- что именно запущено
- здорово ли это
- какой следующий безопасный шаг

## Что зафиксировать для первого pilot

- один основной review target для runtime
- один понятный health target
- кто владеет runtime и кто может менять baseline
- какой клиент или environment стоит в `context label` у reusable template

## Когда этого quickstart уже мало

Переходи в более глубокие документы, если нужно:

- [PRODUCTION.md](../PRODUCTION.md) для полного production setup
- [RUNBOOK.md](../RUNBOOK.md) для release, smoke и operator flow
- [COMMERCIAL-LICENSE.md](../COMMERCIAL-LICENSE.md) и `/upgrade`, если это уже не evaluation, а бизнес-использование
