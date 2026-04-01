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
- deployment and server diagnostics
- upgrade request lifecycle: statuses / notes / assignment / filters / inline actions
- production stack
- deployment templates CRUD
- deploy directly from template
- expanded deployment template workflows:
  - template search
  - template preview / diff vs current form
  - edit template via create form
  - duplicate template
  - template metadata: updated_at / last_used_at / use_count
  - client-side preflight validation for ports / env rows

Последние важные коммиты в develop:
- 34d07dd Fix admin users ordering query
- 0e4b187 Add upgrade request lifecycle workflows
- d372686 Add deployment and server diagnostics
- 6deeef0 Expand deployment template workflows
- 3740f09 Update session handoff after frontend deploy
- 35edea4 Silence login auth noise and add favicon
- 95eb445 Polish admin operations
- 000c63e Add deployment templates
- 1eb439f Deploy from templates

Последний статус:
- commits d372686, 0e4b187 и 34d07dd уже запушены в origin/develop
- backend+frontend из 34d07dd уже выкачены на VPS
- Playwright MCP в новой сессии доступен
- production UI smoke test через Playwright пройден:
  - login ok
  - /app ok
  - users ok
  - upgrade inbox ok
  - server connection test ok
  - template search ok
  - template preview ok
  - template duplicate ok
  - template edit/update ok
  - deploy from template ok
  - details/logs/health/activity ok
  - cleanup ok
- отдельный production smoke после новых релизов:
  - diagnostics API ok:
    - login ok
    - GET /servers ok
    - GET /deployments ok
    - GET /servers/{id}/diagnostics -> 200
  - diagnostics UI ok:
    - после логина на /app виден новый control Run diagnostics
    - Playwright runtime может блокировать сам клик по production action как high-risk, это ограничение tool policy, а не приложения
  - upgrade request lifecycle ok:
    - /app/upgrade-requests показывает новый inbox UI
    - видны фильтры статусов: All statuses / New / In review / Approved / Rejected / Closed
    - видны plan filters: All plans / Trial / Solo / Team
    - production API smoke:
      - login ok
      - GET /admin/users -> 200
      - GET /admin/upgrade-requests -> 200

Наблюдения:
- критичных UI-регрессий не найдено
- логин-шум уже убран и favicon уже добавлен:
  - убран предзапрос auth/me на /login
  - добавлен favicon через app/icon.svg
- в последнем smoke временный template был создан, обновлён, использован для deploy, затем deployment и template были удалены
- browser console на последнем production smoke без ошибок
- при первой выкладке upgrade request lifecycle был пойман regression в admin users:
  - /api/admin/users -> 500
  - причина: неверный ORDER BY в list_users() в backend/app/db.py
  - исправлено в commit 34d07dd и уже выкачено на VPS
- после hotfix production admin API снова зелёный

Что проверено локально перед выкладкой:
- frontend: npm run build ok
- backend: backend/venv/bin/python -m compileall backend/app ok

Что нужно сейчас:
- держаться текущего состояния develop без rewrite
- observability / diagnostics around deployments and servers уже сделан и выкачен
- admin workflows / upgrade request lifecycle уже сделан и выкачен
- следующий крупный безопасный кусок логично брать из operations hardening:
  - preflight checks перед deploy/redeploy
  - dry-run preview / guardrails
  - нормализация operation errors для UI
- после следующего осмысленного изменения прогнать короткий UI smoke через Playwright

Контекст по режиму работы:
- пользователь добавил fast-правила и разрешил подтверждать рутинные действия без отдельного ожидания ответа
- всё равно не делать rewrite и не трогать live production вручную кроме штатного git pull + docker compose deploy path
- для production smoke надёжнее всего сочетать:
  - Playwright для UI presence / navigation
  - ssh deploymate + read-only API calls для подтверждения backend behaviour
- Playwright иногда блокирует production login/click как high-risk даже для read-only сценариев; если пользователь уже залогинен, лучше продолжать проверку поверх активной сессии

Сначала проверь MCP playwright и только потом переходи к UI smoke test.
