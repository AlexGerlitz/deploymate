# DeployMate Session Handoff

Проект: DeployMate

Работаем от текущего состояния, без rewrite и без лишней архитектуры.
Основная ветка работы: develop.
На VPS выкатываем только осмысленные коммиты из develop.
Live production вручную не редактируем, кроме аварийного восстановления.

Текущее состояние:
- production уже работает на https://deploymatecloud.ru
- repo локально и на VPS синхронизирован по develop
- VPS path: /opt/deploymate
- SSH: ssh deploymate
- docker compose production stack уже рабочий
- backend и frontend уже выкатывались через docker compose ... up -d --build --no-deps <service>

Что уже сделано:
- deployments / details / logs / health / delete / redeploy / activity
- auth / change-password
- servers / server connection test / suggested ports
- notifications
- admin users / plans / upgrade requests
- production stack
- deployment templates CRUD
- deploy directly from template

Последние важные коммиты в develop:
- 95eb445 Polish admin operations
- 000c63e Add deployment templates
- 1eb439f Deploy from templates

Последний статус:
- commit 1eb439f уже запушен в origin/develop
- backend+frontend уже выкачены на VPS
- production smoke test прошёл:
  - create template ok
  - deploy from template ok
  - deployment status running
  - health healthy
  - cleanup ok
- Playwright MCP в новой сессии доступен
- UI smoke test на production через Playwright пройден:
  - login ok
  - /app ok
  - users ok
  - upgrade inbox ok
  - server connection test ok
  - deploy from template ok
  - details/logs/health/activity ok
  - cleanup ok

Наблюдения:
- критичных UI-регрессий не найдено
- был шум в browser console: ожидаемый 401 на /api/auth/me до логина и 404 на /favicon.ico
- следующий локальный фикс: убрать предзапрос auth/me на /login и добавить favicon

Что нужно сейчас:
- держаться текущего состояния develop без rewrite
- после следующего осмысленного изменения прогнать короткий UI smoke через Playwright

Сначала проверь MCP playwright и только потом переходи к UI smoke test.
