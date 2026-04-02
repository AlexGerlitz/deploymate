# DeployMate Session Handoff

Проект: DeployMate

Работаем прагматично и экономно по лимитам.
Без rewrite.
Основная ветка: `develop`.
Прод выкатываем только из `develop`.
Live production вручную не правим, кроме штатного `git pull` + `docker compose ... up -d --build --no-deps <service>`.

## Текущее состояние

- production: `https://deploymatecloud.ru`
- VPS path: `/opt/deploymate`
- SSH: `ssh deploymate`
- локальный repo и VPS синхронизируются через `develop`
- production VPS сейчас на commit: `7302c26`
- локальное рабочее дерево на момент handoff должно быть чистым

## Что уже есть в продукте

- auth / change-password
- deployments / logs / health / delete / redeploy / activity
- servers / connection test / suggested ports / diagnostics
- notifications
- deployment templates CRUD + duplicate/edit/search/preview/use_count
- admin users / plans / upgrade requests
- ops overview / exports / filters
- admin overview / exports / filters
- admin audit trail / exports
- backup bundle / restore dry-run / conflict analysis
- scripted preflight
- scripted post-deploy smoke
- local frontend admin smoke mode and smoke script

## Последние важные коммиты

- `7302c26` Add admin frontend smoke mode and tests
- `18c4af2` Polish admin page microcopy and guards
- `dd2b4a4` Refresh admin audit with users panel
- `1e3c4fb` Debounce admin search filters
- `f682ee3` Polish backup restore validation workflow
- `02e97f8` Add backup bundle and restore dry run
- `52cd172` Add admin audit trail and exports
- `3b14d1f` Add admin overview filters and exports
- `ce2fd3d` Add backend operations overview and exports

## Что проверено

### Production

- `/login` ok
- `/app` ok
- `/app/users` ok
- `/app/upgrade-requests` ok
- `/api/health` ok
- `backup bundle` ok
- `restore dry-run` ok
- logout / session invalidation ok

Использовать:

```bash
DEPLOYMATE_BASE_URL=https://deploymatecloud.ru \
DEPLOYMATE_ADMIN_USERNAME=admin \
DEPLOYMATE_ADMIN_PASSWORD='<secret>' \
bash scripts/post_deploy_smoke.sh
```

### Локально

- `npm --prefix frontend run build` ok
- `npm --prefix frontend run smoke:admin` ok
- backend compile/test path уже используется отдельно при backend-изменениях

## Новый базовый режим работы после reset

Главное правило: не делать много мелких циклов `прочитал -> поправил 1 кнопку -> commit -> push -> deploy`.

Работаем batch-ами.

### Экономный процесс

1. Сначала собрать пакет задач одной темы.
   Примеры:
   - `admin UI polish batch`
   - `backup UX batch`
   - `restore analyzer batch`

2. Внести все правки локально одним пакетом.

3. Прогнать только релевантные проверки:
   - frontend-only: `npm --prefix frontend run smoke:admin` и `npm --prefix frontend run build`
   - backend-only: `python3 -m py_compile ...` и нужные unit tests
   - full stack: оба набора

4. Сделать один commit на пакет.

5. Сделать один push.

6. Сделать один deploy.
   - frontend-only если менялся только frontend
   - backend-only если менялся только backend
   - full stack только если реально нужно

7. Один финальный production smoke.

### Чего избегать

- не читать одни и те же большие файлы по кругу
- не деплоить после каждой косметической правки
- не дробить одну тему на 5-10 commit/deploy циклов
- не делать лишние промежуточные отчеты длиннее пары строк

## Минимальный lean runbook

```bash
# 1. локальный пакет правок

# 2. frontend batch
npm --prefix frontend run smoke:admin
npm --prefix frontend run build

# 3. backend batch при необходимости
python3 -m py_compile backend/app/main.py backend/app/routes/*.py backend/app/services/*.py backend/app/db.py backend/app/schemas.py
PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests -p 'test_*.py'

# 4. фиксация
git add <files>
git commit -m "Describe the batch"
git push origin develop

# 5. deploy
ssh deploymate
cd /opt/deploymate
git fetch origin
git switch develop
git pull --ff-only origin develop
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --no-deps frontend

# 6. smoke
DEPLOYMATE_BASE_URL=https://deploymatecloud.ru DEPLOYMATE_ADMIN_USERNAME=admin DEPLOYMATE_ADMIN_PASSWORD='<secret>' bash scripts/post_deploy_smoke.sh
```

## Что делать в новой сессии первым делом

1. Прочитать этот файл.
2. Проверить `git status --short`.
3. Понять, frontend-only задача или backend/full-stack.
4. Не прыгать сразу в deploy.
5. Собирать следующий смысловой batch, а не разовую мелочь.

## Приоритет следующей работы

Следующие осмысленные безопасные направления:

- frontend smoke coverage для admin pages расширять дальше
- admin UI consistency batch
- restore analyzer polish без real apply
- docs/runbook polishing

Не лезть без отдельной причины в:

- auth flow
- runtime deploy write-paths
- destructive restore/apply
- рискованные schema/data migrations

## Текущее локальное состояние перед возможным релизом

- большой frontend batch уже собран локально и `prod-ready`
- в него входят:
  - admin audit UX
  - backup/restore panel polish
  - bulk user actions
  - bulk inbox actions
- bulk users использует существующий single-user PATCH path в цикле
- bulk inbox сейчас меняет только lifecycle status и не делает mass approve
