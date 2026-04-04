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
  - structured restore preparation plan with per-section preparation modes, recommended actions, and richer import-preparation handoff/export output

## Product Rule

- интерфейс DeployMate должен становиться не просто функциональным, а интуитивно понятным
- для любого важного сценария пользователю должно быть очевидно, куда нажать, чтобы пойти по основному пути
- главный следующий шаг на экране должен читаться сразу, без чтения документации и без догадок
- если на экране есть много действий, главный путь не должен теряться среди второстепенных controls
- если логика уже работает, но пользователь всё ещё не понимает, что делать дальше, такой экран считать незаконченным

Практический вывод из текущего состояния проекта:

- сейчас проект уже сильнее как operator/review console, чем как интуитивный продуктовый интерфейс
- главная UX-проблема не в отсутствии функций, а в том, что основной путь местами тонет среди exports, filters, refresh и второстепенных tools
- ближайшие продуктовые пакеты нужно оценивать не только по safety и полноте логики, но и по тому, стал ли следующий шаг очевиднее для клиента

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
- restore workspace теперь ещё и явно показывает, что можно готовить к import дальше, что держать на merge review, а что оставлять только в dry-run
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

### 12. Restore import preparation стал более структурированным рабочим слоем

На backend:

- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [test_restore_dry_run.py](/Users/alexgerlitz/deploymate/backend/tests/test_restore_dry_run.py)

Что добавлено:

- каждый restore section теперь возвращает `preparation_mode`
- каждый restore section теперь возвращает `recommended_action`
- общий restore summary теперь возвращает `preparation_summary`
- summary теперь считает секции по четырём режимам: `prepare_import`, `merge_review`, `validate_only`, `dry_run_only`

На frontend:

- [users/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [admin-export-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-export-utils.js)
- [admin-smoke-fixtures.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-smoke-fixtures.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- новая `Preparation mix` card в restore overview
- новый preparation summary внутри import-preparation card
- per-section preparation mode и recommended action прямо в restore section cards
- markdown/CSV export теперь тоже тащит structured preparation guidance
- restore smoke anchors теперь проверяют новый planning слой

Простой вывод:

- restore dry-run теперь объясняет не только риск, но и следующий безопасный способ работы с каждой секцией bundle
- оператору проще отделить реальные import candidates от merge-review и dry-run-only зон

### 13. Появился узкий DeployMate vertical feature scaffold

На repo tooling:

- [scaffold_deploymate_feature.sh](/Users/alexgerlitz/deploymate/scripts/scaffold_deploymate_feature.sh)
- [Makefile](/Users/alexgerlitz/deploymate/Makefile)
- [README.md](/Users/alexgerlitz/deploymate/README.md)

Что добавлено:

- новый `make scaffold-deploymate-feature`
- wrapper поверх `scaffold_deploymate_surface.sh` для текущих DeployMate-паттернов
- три узких режима: `review-workflow`, `recovery-workflow`, `guardrail-workflow`
- кроме базового surface scaffold теперь сразу создаются:
  - frontend feature-pack helper stub
  - generated smoke checks file
  - dedicated frontend smoke runner script

Что это значит practically:

- следующая review/recovery/admin-heavy фича теперь стартует не только со страницы и backend route
- она сразу получает ещё и project-specific pack для summary/export/smoke слоя
- это должно уменьшить повторную ручную сборку на ближайших пакетах, а не когда-нибудь потом

### 14. Import review стал отдельным recovery workspace

На backend:

- [import_review.py](/Users/alexgerlitz/deploymate/backend/app/routes/import_review.py)
- [import_review.py](/Users/alexgerlitz/deploymate/backend/app/services/import_review.py)
- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [test_import_review_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_import_review_api_flow.py)

Что добавлено:

- новый `GET /import-review`
- backend собирает current backup bundle, restore dry-run и controlled import plan в один workspace response
- `import-review` больше не starter queue, а recovery-specific review surface

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [import-review-feature-pack.js](/Users/alexgerlitz/deploymate/frontend/app/lib/import-review-feature-pack.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)

Что добавлено:

- отдельная страница `/app/import-review`
- bundle card, dry-run readiness card и plan-status card
- controlled import boundary card с scope summary, reviewer guidance и typed confirmation phrase
- фильтрация import-plan sections по `plan_state` и search
- JSON / Markdown / visible-sections CSV export для текущего import review
- ссылка обратно в `/app/users` для полного restore workspace

Что это делает:

- controlled import/apply boundary теперь видна как отдельный экран, а не только как кусок внутри users/restore workspace
- оператору проще быстро увидеть текущий backup, readiness и import scope без лишнего admin шума

### 15. Restore и import-review теперь связаны в один recovery маршрут

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [admin-page-utils.js](/Users/alexgerlitz/deploymate/frontend/app/lib/admin-page-utils.js)
- [import-review-feature-pack.js](/Users/alexgerlitz/deploymate/frontend/app/lib/import-review-feature-pack.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- из restore import plan card теперь можно открыть dedicated `import-review` именно с тем bundle, dry-run и import plan, которые оператор только что собрал
- handoff идёт через browser session storage, без отдельного backend session-layer
- `import-review` теперь явно показывает source workspace: `restore handoff` или `live backup`
- на `import-review` можно принудительно сбросить handoff и вернуться к current live backup baseline
- smoke anchors теперь покрывают и restore-side handoff кнопку, и import-review source card

Что это значит practically:

- recovery flow больше не выглядит как два несвязанных экрана
- review теперь можно продолжать на отдельной странице без потери именно того bundle-контекста, который только что проверяли
- при этом всё ещё остаётся явная возможность вернуться к live backup и не перепутать источники данных

### 16. Import review получил готовый approval trail для handoff

На backend:

- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [test_import_review_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_import_review_api_flow.py)

Что добавлено:

- import plan summary теперь отдаёт `approval_packet_title`
- import plan summary теперь отдаёт `approval_subject_line`
- import plan summary теперь отдаёт `approval_share_summary`
- import plan summary теперь отдаёт `approval_next_step`

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [import-review-feature-pack.js](/Users/alexgerlitz/deploymate/frontend/app/lib/import-review-feature-pack.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)

Что добавлено:

- approval card теперь показывает packet title, subject line, share summary и next step
- можно скачать не только markdown approval packet, но и structured `approval trail JSON`
- можно скопировать короткий handoff summary без ручной сборки текста

Что это значит practically:

- `import-review` теперь не только объясняет решение, но и сразу собирает короткий пакет для передачи дальше
- оператору не нужно руками пересказывать bundle name, plan status, decision question и следующий шаг
- approval handoff стал больше похож на законченный workflow-артефакт, а не на один markdown-файл

### 17. Import review теперь доводит review до controlled preparation handoff

На backend:

- [root.py](/Users/alexgerlitz/deploymate/backend/app/routes/root.py)
- [schemas.py](/Users/alexgerlitz/deploymate/backend/app/schemas.py)
- [test_import_review_api_flow.py](/Users/alexgerlitz/deploymate/backend/tests/test_import_review_api_flow.py)

Что добавлено:

- import plan summary теперь отдаёт `preparation_status`
- import plan summary теперь отдаёт `preparation_packet_title`
- import plan summary теперь отдаёт `preparation_share_summary`
- import plan summary теперь отдаёт `preparation_summary`
- import plan summary теперь отдаёт `preparation_checklist`
- import plan summary теперь отдаёт `preparation_handoff_note`
- import plan summary теперь отдаёт `preparation_next_step`

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [import-review-feature-pack.js](/Users/alexgerlitz/deploymate/frontend/app/lib/import-review-feature-pack.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)

Что добавлено:

- новый `Controlled preparation handoff` card внутри `import-review`
- markdown export для preparation packet
- structured `preparation trail JSON`
- copy action для короткой preparation summary

Что это значит practically:

- recovery flow теперь не обрывается на approval handoff
- следующий безопасный шаг тоже упакован: можно передать дальше scope, checklist и next step для preparation работы
- это всё ещё не apply-path и не скрытый destructive flow, а отдельный handoff на следующую безопасную стадию

### 18. Началась UX-пересборка вокруг явного главного действия

На frontend:

- [admin-ui.js](/Users/alexgerlitz/deploymate/frontend/app/app/admin-ui.js)
- [users/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/users/page.js)
- [server-review/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/server-review/page.js)
- [import-review/page.js](/Users/alexgerlitz/deploymate/frontend/app/app/import-review/page.js)
- [import-review.txt](/Users/alexgerlitz/deploymate/scripts/generated_smoke_checks/import-review.txt)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- `AdminPageHeader` теперь умеет принимать явный `primaryAction`, а `Refresh` больше не считается главным действием по умолчанию
- `Users` header теперь ведёт прямо к `Create user`
- `Server Review` header теперь ведёт прямо к `Add server target`
- `Import Review` header теперь ведёт прямо к `Download preparation packet`
- внутри `import-review` появился отдельный `Main next step` card, который явно говорит, что делать дальше после review

Что это значит practically:

- проект начал переход от “мощной панели инструментов” к более понятному продукту с читаемым главным путём
- на ключевых admin/recovery поверхностях теперь заметнее, что является главным действием, а что просто вспомогательным инструментом
- это ещё не полный UX-рефактор всего продукта, но правильный системный сдвиг уже начался

### 19. `/app` начал превращаться в сценарный вход в продукт

На frontend:

- [page.js](/Users/alexgerlitz/deploymate/frontend/app/app/page.js)
- [project_automation_smoke_checks.sh](/Users/alexgerlitz/deploymate/scripts/project_automation_smoke_checks.sh)

Что добавлено:

- на верхнем уровне `/app` появился отдельный сценарный блок с понятными путями
- теперь сверху страницы виднее основные сценарии: deployment, runtime review, server review и recovery/admin path
- этот блок не заменяет deeper workspace sections ниже, а помогает сначала выбрать очевидный основной путь

Что это значит practically:

- `/app` стал меньше похож на просто обзорный dashboard и больше на продуктовый входной экран
- новый пользователь быстрее понимает не только текущее состояние системы, но и с какого сценария начать работу
- это продолжает тот же UX-сдвиг: сначала очевидный next step, потом уже детали и второстепенные инструменты

## Important Practical Meaning

Если коротко:

- server-review теперь можно считать законченным отдельным экраном
- это уже не “заготовка”
- это уже не “нужно ещё чуть-чуть, чтобы стало usable”
- это уже рабочее место для серверов
- deployment detail теперь тоже стал сильнее как рабочее место для runtime review и incident handoff
- restore layer теперь уже не просто report, а более структурированный preparation handoff
- у проекта теперь есть ещё и более узкий ускоритель именно под текущие DeployMate feature slices, а не абстрактный scaffold “на будущее”
- recovery layer теперь ещё и получил отдельный import-review экран для controlled import boundary
- restore и import-review теперь уже связаны в один маршрут, а не живут как две параллельные поверхности без handoff
- import-review теперь ещё и умеет выдавать короткий approval trail, который проще отправить дальше без пересказа руками
- import-review теперь доводит review ещё и до preparation handoff, то есть следующий безопасный шаг тоже оформлен как рабочий артефакт
- поверх этого началась явная UX-пересборка: главный следующий шаг стали выводить вперёд, а не прятать среди второстепенных действий
- `/app` поверх этого тоже начал меняться в сторону сценарного входа, а не просто обзорной панели

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
- повторный `cd backend && venv/bin/python -m unittest tests.test_restore_dry_run` после structured preparation plan -> ok
- повторный `npm --prefix frontend run build` после restore UI/export updates -> ok
- `bash -n scripts/scaffold_deploymate_feature.sh` -> ok
- dry run `scaffold_deploymate_feature.sh` на временном target repo -> ok
- `cd backend && venv/bin/python -m unittest tests.test_import_review_api_flow tests.test_restore_dry_run` -> ok
- `npm --prefix frontend run build` после `import-review` surface -> ok
- `git diff --check` -> ok
- повторный `cd backend && venv/bin/python -m unittest tests.test_import_review_api_flow tests.test_restore_dry_run` после restore -> import-review handoff -> ok
- повторный `npm --prefix frontend run build` после handoff/source-layer updates -> ok
- повторный `cd backend && venv/bin/python -m unittest tests.test_import_review_api_flow tests.test_restore_dry_run` после approval trail layer -> ok
- повторный `npm --prefix frontend run build` после approval trail updates -> ok
- повторный `cd backend && venv/bin/python -m unittest tests.test_import_review_api_flow tests.test_restore_dry_run` после preparation handoff layer -> ok
- повторный `npm --prefix frontend run build` после preparation handoff updates -> ok
- `npm --prefix frontend run build` после primary-action / main-next-step UX package -> ok
- `git diff --check` после primary-action / main-next-step UX package -> ok
- `npm --prefix frontend run build` после `/app` scenario-entry UX package -> ok
- `git diff --check` после `/app` scenario-entry UX package -> ok
- `README.md` / `RUNBOOK.md` обновлены под `server-review` как основной server workspace

Простой вывод:

- текущий пакет по scaffold + server-review + runtime detail handoff + richer backend mutation trace + stronger restore preparation guardrails + structured restore preparation guidance + DeployMate-specific feature scaffold + import-review workspace + restore/import-review handoff + approval trail layer + preparation handoff layer + primary-action UX package + `/app` scenario-entry layer находится в рабочем состоянии

## Best Next Step

Самый разумный следующий шаг сейчас:

1. Считать restore/runtime review layer уже достаточно сильным на уровне review/preparation и не раздувать его бесконечной полировкой.
2. Если делать ускоритель разработки, то только такой, который окупится прямо на следующих пакетах DeployMate, а не абстрактный framework “на будущее”.
3. Узкий DeployMate-specific vertical feature scaffold теперь уже есть, значит дальше его надо проверять только на реальной ближайшей фиче.
4. `import-review` уже проверил scaffold на реальной recovery фиче, значит дальше можно использовать тот же путь только там, где он реально экономит ручную сборку.
5. Следующий продуктовый пакет теперь логичнее брать уже после главного entry/CTA слоя: либо более явный sequencing workflow для recovery/preparation, либо следующий intent-first путь на другом сильном экране, но не возврат к скрытому toolbox-style интерфейсу.

Что из ускорения реально стоит делать сейчас:

- только то, что ускорит следующие реальные DeployMate фичи уже в ближайших пакетах
- vertical feature scaffold под текущие review/recovery/admin patterns проекта
- повторно используемые примитивы именно для review/export/guardrail flows, если они сразу войдут в следующую работу

Что из ускорения сейчас делать НЕ надо:

- ещё один общий automation framework ради красоты
- слишком абстрактный scaffold “для любых будущих проектов”
- крупный refactor, который не сокращает время до следующей законченной фичи в самом DeployMate

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
