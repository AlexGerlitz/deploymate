# DeployMate Handoff

Updated: 2026-04-04

## Current State

- Branch: `develop`
- Working tree at the last published checkpoint was clean; verify with `git status --short` before continuing.
- Latest published packages:
  - dedicated `server-review` workspace for server operations
  - synced docs/handoff for that new server flow
  - richer runtime detail handoff/export tooling on deployment detail pages
  - richer deployment mutation trace in backend activity, including explicit started events for create/redeploy/delete
  - clearer restore import-preparation decision layer for backup dry-run
  - restore dry-run cross-section reference guardrails for missing linked users, servers, and templates
  - deeper restore preparation workspace with risk-focused filtering, search, and visible-sections CSV export
  - stronger destructive runtime guardrails on deployment delete flow with typed confirmation review

## Short Version

Если совсем по-человечески:

- scaffold уже не просто “улучшали”
- его реально прогнали на живой продуктовой задаче
- результат этой проверки: появился новый surface [server-review/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/server-review/page.js)
- это теперь полноценное место для работы с серверами

Что это значит:

- серверы больше не должны жить в двух местах сразу
- `/app` теперь обзорный экран
- `/app/server-review` теперь основной экран для серверной работы
- deployment detail теперь лучше объясняет текущее runtime-состояние и даёт готовый handoff-артефакт, а не только raw diagnostics
- backend activity теперь лучше объясняет не только результат mutation, но и сам старт runtime-операции
- restore dry-run теперь понятнее отвечает на вопрос “готов ли этот bundle хотя бы к import preparation”
- restore dry-run теперь ещё и заранее ловит битые связи между секциями bundle
- restore workspace теперь проще отфильтровать под конкретный риск, а не глазами читать всё подряд
- удаление deployment теперь требует явного review и typed confirmation вместо одного случайного confirm popup

## What Was Actually Done

### 1. Scaffold был проверен на реальной фиче

Через scaffold был создан и затем доведён до реального состояния новый surface:

- [server-review/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/server-review/page.js)

Это уже не scaffold-demo и не mock page.

Это живая страница поверх настоящего server API.

### 2. Server review стал полноценным контуром

Сейчас в `server-review` есть:

- просмотр серверов
- поиск и review filters
- table view
- saved views
- export
- локальный audit trail на странице
- create server
- edit server
- test connection
- diagnostics
- suggested ports
- delete server

Простой вывод:

- серверный workflow теперь собран в одном месте
- для работы с серверами не нужно прыгать обратно на `/app`

### 3. Старый дублирующий server flow на `/app` был упрощён

На [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/page.js):

- серверный блок больше не тащит на себе полный CRUD + diagnostics flow
- там теперь короткий обзор и вход в `Server review`
- в верхних actions тоже добавлена ссылка на `Server review`

Простой вывод:

- `/app` снова стал обзорной панелью
- `server-review` стал рабочим экраном по серверам

### 4. Лишний backend starter-мусор был удалён

Scaffold сначала нагенерил отдельный fake backend под `server_review`, но после перевода страницы на реальные `/servers` endpoints этот слой стал лишним.

Он был убран.

Что осталось правильным:

- реальный backend `/servers`
- реальный frontend `server-review`

Что это значит:

- нет дублирующего API только ради шаблона
- меньше лишней поддержки

### 5. Реальный update flow серверов добавлен в backend

На backend добавлен настоящий update путь для серверов:

- db update:
  - [db.py](/Users/alexgerlitz/deploymate/backend/app/db.py)
- route update:
  - [servers.py](/Users/alexgerlitz/deploymate/backend/app/routes/servers.py)
- schema update:
  - [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- test update:
  - [test_server_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_server_api_flow.py)

Простой вывод:

- сервер теперь можно не только создать и удалить, но и нормально редактировать

### 6. Runtime detail стал нормальным handoff surface

На [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js):

- добавлен plain-language runtime summary для людей без технического контекста
- добавлен downloadable incident snapshot в JSON
- добавлен downloadable handoff в Markdown
- activity лента получила search / level filter / sort
- текущий activity view теперь можно экспортировать в CSV

На [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh):

- runtime smoke теперь проверяет новый handoff/export слой deployment detail

Простой вывод:

- deployment detail теперь годится не только для диагностики, но и для нормальной передачи состояния дальше
- оператору больше не нужно вручную собирать картину из health, logs, diagnostics и activity

### 7. Backend activity стал полезнее для runtime review

На [deployment_mutations.py](/Users/alexgerlitz/deploymate/backend/app/services/deployment_mutations.py):

- create/redeploy/delete теперь пишут явные `started` activity events
- стартовые activity messages теперь содержат более человеческое описание target, image, ports и env-shape
- failure activity messages теперь лучше объясняют, на каком шаге и в каком target произошёл сбой

На [test_deployment_routes.py](/Users/alexgerlitz/deploymate/backend/tests/test_deployment_routes.py) и [test_deployment_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_deployment_api_flow.py):

- добавлены проверки на эти новые mutation-start events и richer activity messages

Простой вывод:

- runtime detail activity теперь показывает более полезную историю
- при create/redeploy/delete оператору легче понять не только чем всё закончилось, но и что именно система пыталась сделать

### 8. Restore dry-run стал явным import-preparation decision surface

На backend:

- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [test_restore_dry_run.py](/Users/alexgerlitz/deploymate/backend/tests/test_restore_dry_run.py)

Что добавлено:

- restore summary теперь возвращает `readiness_status`
- summary теперь возвращает human-readable `plain_language_summary`
- summary теперь возвращает явный `next_step`
- summary теперь возвращает `highest_risk_sections`

На frontend:

- [users/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [admin-export-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-export-utils.js)
- [admin-smoke-fixtures.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-smoke-fixtures.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- import readiness card
- next-step card
- plain-language import-preparation summary
- markdown export для restore preparation handoff
- restore smoke теперь проверяет новый preparation слой

Простой вывод:

- оператору теперь проще понять, можно ли вообще двигаться к import preparation
- даже человеку без технического бэкграунда стало проще объяснить, почему bundle safe, review или blocked

### 9. Restore dry-run теперь ловит cross-section reference risks

На backend:

- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [test_restore_dry_run.py](/Users/alexgerlitz/deploymate/backend/tests/test_restore_dry_run.py)

Что добавлено:

- upgrade requests теперь предупреждают о ссылках на отсутствующих пользователей
- templates теперь предупреждают о ссылках на отсутствующие серверы
- deployments теперь блокируются, если ссылаются на отсутствующий сервер
- deployments теперь предупреждают о ссылках на отсутствующий template

Простой вывод:

- bundle теперь раньше сообщает, что в нём сломано между секциями
- оператору не нужно догадываться, почему import preparation нельзя считать безопасным

### 10. Restore workspace стал полезнее для ручного review

На frontend:

- [users/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [admin-export-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-export-utils.js)

Что добавлено:

- search по restore sections
- highest-risk-only filter
- summary по текущей видимой выборке sections
- CSV export именно текущего видимого restore view
- per-section issue summary прямо в карточках sections

Простой вывод:

- теперь проще быстро сузить restore review до реальных проблемных зон
- и проще отдать кому-то именно текущую отфильтрованную картину, а не весь отчёт целиком

### 11. Delete deployment получил нормальные destructive guardrails

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)

На smoke checks:

- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что изменилось:

- вместо простого `window.confirm` теперь открывается delete review panel
- пользователь видит impact summary перед удалением
- для удаления нужно руками ввести имя deployment
- smoke checks теперь проверяют новый delete-review слой и новые restore preparation controls

Простой вывод:

- случайно удалить deployment стало заметно сложнее
- runtime detail теперь лучше подходит для осторожной операторской работы, а не только для быстрых кликов

## Important Practical Meaning

Если коротко:

- server-review теперь можно считать законченным отдельным экраном
- это уже не “заготовка”
- это уже не “нужно ещё чуть-чуть, чтобы стало usable”
- это уже рабочее место для серверов
- deployment detail теперь тоже стал сильнее как рабочее место для runtime review и incident handoff

## What Was Verified

Проверено локально:

- `bash -n scripts/scaffold_deploymate_surface.sh` -> ok
- `cd backend && venv/bin/python -m unittest tests.test_server_api_flow` -> ok
- `npm --prefix frontend run build` -> ok
- `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime` -> ok
- `cd backend && venv/bin/python -m unittest tests.test_deployment_routes tests.test_deployment_api_flow` -> ok
- `cd backend && venv/bin/python -m unittest tests.test_restore_dry_run` -> ok
- `FRONTEND_SMOKE_PORT=3007 npm --prefix frontend run smoke:restore` -> ok
- `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime` -> ok
- `git diff --check` -> ok
- `README.md` / `RUNBOOK.md` обновлены под `server-review` как основной server workspace

Простой вывод:

- текущий пакет по scaffold + server-review + runtime detail handoff + richer backend mutation trace + stronger restore preparation guardrails находится в рабочем состоянии

## Best Next Step

Самый разумный следующий шаг сейчас:

1. Считать restore/runtime review layer достаточно сильным для текущего этапа и не раздувать его бесконечной полировкой.
2. Переключиться на следующий safety-heavy продуктовый слой: recovery flows, import/apply boundaries или operator guardrails вокруг опасных действий.
3. Если брать следующий большой пакет, самый логичный кандидат сейчас: recovery/operator safety вместо ещё одного review dashboard.

Что сейчас уже НЕ является хорошим следующим шагом:

- ещё один абстрактный раунд улучшения scaffold
- возврат полного server CRUD обратно на `/app`
- создание второго server screen рядом с `server-review`

## Resume Prompt

Если нужно быстро продолжить в новой сессии, используй такой prompt:

```text
Прочитай HANDOFF.md и продолжи работу из текущего состояния.
Считай, что server-review уже стал полноценным server workspace внутри DeployMate.
Сначала проверь, что server-review flow, runtime detail handoff/export, richer backend mutation activity trace, restore preparation layer и новые guardrails на месте.
Потом переходи к следующей продуктовой области без возврата к старому server flow на /app.
```

## Work Prompt

Если нужен более жёсткий рабочий prompt, чтобы новый чат не тормозил и не спрашивал лишнее, используй такой:

```text
Прочитай HANDOFF.md и сразу продолжай работу автономно.
Не останавливайся на плане и не задавай лишних вопросов, если можно безопасно принять разумное решение по локальному контексту.
Сначала быстро проверь git status, последние коммиты и ключевые файлы, потом сразу делай следующий полезный шаг.
Если задача распадается на несколько связанных частей, доводи её до рабочего состояния полностью: код, проверки, handoff/docs при необходимости.
Останавливайся с вопросом только если есть реально рискованная развилка, destructive action или неоднозначность, которую нельзя снять из кода и текущего состояния репозитория.
Работай с git и GitHub на своё усмотрение в рамках существующего flow репозитория: сам решай, когда уместны commit, push, PR flow, pr-watch и pr-land-sync, не спрашивая об этом отдельно.
Делай чистые логические коммиты, не плодя лишний шум.
Если пакет изменений уже выглядит как нормальная маленькая история, сам доводи его до commit/push-ready состояния.
```

## Git Cadence

Чтобы GitHub выглядел презентабельно, правило должно быть простое:

- коммитить не по каждой мелочи, а по каждому законченному логическому куску
- пушить не после каждого коммита, а после осмысленного checkpoint

Практически это значит:

- хороший коммит:
  - одна понятная тема
  - проходит релевантную локальную проверку
  - имеет внятное сообщение
- плохой коммит:
  - смесь scaffold, backend, docs и UI без общей идеи
  - “fix”, “wip”, “tmp”, если этого можно избежать
  - промежуточное сломанное состояние без причины

Нормальная частота:

- коммит: когда завершён один смысловой кусок работы
- push: когда собран 1 хороший коммит или маленькая серия из 2-3 связанных коммитов
- для длинной сессии: лучше несколько чистых коммитов и один push серии, чем 12 мелких push подряд

Простой ориентир:

- если изменение уже можно объяснить одной короткой фразой, это кандидат на коммит
- если локально уже не стыдно открыть diff в PR, это кандидат на push

Для этого репо хороший стиль такой:

- 1 коммит на платформенный/infra кусок
- 1 коммит на конкретную продуктовую фичу
- push после того, как оба куска собираются в аккуратную историю

## Fast Resume

1. Открой [HANDOFF.md](/Users/alexgerlitz/deploymate/HANDOFF.md).
2. Проверь текущее состояние:
   - `git status --short`
   - `git rev-parse --short HEAD`
3. Если продолжаешь server-review track:
   - открой [server-review/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/server-review/page.js)
   - открой [starter-api.js](/Users/alexgerlitz/deploymate/frontend/app/app/server-review/starter-api.js)
   - открой [servers.py](/Users/alexgerlitz/deploymate/backend/app/routes/servers.py)
   - открой [test_server_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_server_api_flow.py)
4. Если продолжаешь runtime detail track:
   - открой [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
   - открой [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)
5. Если продолжаешь backend runtime trace track:
   - открой [deployment_mutations.py](/Users/alexgerlitz/deploymate/backend/app/services/deployment_mutations.py)
   - открой [test_deployment_routes.py](/Users/alexgerlitz/deploymate/backend/tests/test_deployment_routes.py)
   - открой [test_deployment_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_deployment_api_flow.py)
6. Если продолжаешь restore preparation track:
   - открой [users/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
   - открой [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
   - открой [test_restore_dry_run.py](/Users/alexgerlitz/deploymate/backend/tests/test_restore_dry_run.py)
7. Если продолжаешь runtime destructive-guardrails track:
   - открой [page.js](/Users/alexgerlitz/deploymate/frontend/app/deployments/[deploymentId]/page.js)
   - открой [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)
8. Быстрые проверки:
   - `cd backend && venv/bin/python -m unittest tests.test_server_api_flow`
   - `cd backend && venv/bin/python -m unittest tests.test_deployment_routes tests.test_deployment_api_flow`
   - `cd backend && venv/bin/python -m unittest tests.test_restore_dry_run`
   - `npm --prefix frontend run build`
   - `FRONTEND_SMOKE_PORT=3006 npm --prefix frontend run smoke:runtime`
   - `FRONTEND_SMOKE_PORT=3007 npm --prefix frontend run smoke:restore`
9. Если цель — завершить этот пакет:
   - проверить docs/handoff diff
   - собрать commit
