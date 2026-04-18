# Пилотный onboarding checklist для DeployMate

Updated: 2026-04-18

Этот документ нужен для первого платного или design-partner пилота.
Его задача простая: не обсуждать продукт абстрактно, а быстро провести команду через install, первый deploy, первый handoff и первый support-ритм.

## Что должно быть понятно до старта

До любого пилота нужно собрать пять вещей:

- где живёт инфраструктура: client-owned, self-owned или смешанная модель
- сколько сервисов и серверов реально попадут в pilot
- кто админ, кто оператор, кто принимает handoff
- какой runtime считается главным review target
- нужен ли только internal-team path или уже agency / multi-client path

Если это не собрано, пилот почти всегда превращается в расплывчатую “оценку платформы” вместо короткого рабочего запуска.

## Этап 1. Scope review

На первом коротком созвоне или в первом письменном intake должны появиться:

- домен и production host
- способ SSH-доступа
- главный сервис или primary service для stack
- один ожидаемый health target
- источник релиза: image, ref, commit или другой release source
- нужно ли вести один клиентский контекст или несколько

Результат этапа:

- понятно, какой package path нужен
- понятно, какой self-hosted сценарий запускаем первым
- понятно, что считать успешным первым deploy

## Этап 2. Self-hosted install

Используй [ru-install-quickstart.md](./ru-install-quickstart.md) как базовый install path.

На этом этапе должен появиться живой инстанс DeployMate с:

- production env
- pinned SSH trust
- рабочим доменом
- живыми `/app` и `/api/health`

Результат этапа:

- инстанс не “почти настроен”, а уже реально доступен
- можно входить в интерфейс и двигаться в первый deploy

## Этап 3. Первый deploy

Используй [ru-operator-quickstart.md](./ru-operator-quickstart.md) как базовый operator path.

Минимальный первый проход:

1. сохранить один server target
2. прогнать connection check
3. выбрать один image или один stack
4. сделать один deploy
5. открыть deployment detail

Результат этапа:

- в системе уже есть не пустая инфраструктура, а первый живой runtime
- оператор видит не только “успешно выкатили”, а реальный review surface

## Этап 4. Проверка handoff

Перед тем как считать pilot полезным, второй человек должен открыть `Deployment passport` и понять:

- что запущено
- из какого релиза это приехало
- здорово ли оно
- что происходило недавно
- кто может действовать
- какой следующий безопасный шаг

Если второй оператор без автора проекта не понимает состояние за 1-2 минуты, pilot ещё не доказал главный wedge.

## Этап 5. Первый support rhythm

Минимальный support motion на первую неделю должен включать:

- одну проверку release path
- одну проверку health target и review target
- одну проверку reusable template / `context label`
- одну handoff-передачу между двумя людьми

Смысл не в объёме процессов, а в том, чтобы доказать: DeployMate помогает сопровождать сервис, а не только один раз его выкатить.

## Что должно получиться к концу первой недели

- хотя бы один live runtime читается через `Deployment passport`
- install path повторяем и не держится на устных знаниях автора
- операторский путь `server -> deploy -> observe -> next safe action` реально пройден
- handoff между людьми возможен без SSH-археологии
- buyer понимает, за что платит: за ясность эксплуатации и передачи, а не за абстрактную “ещё одну панель”

## Что запросить у команды после пилота

- где ещё осталась зависимость от shell и устного контекста
- где passport уже спасает время, а где ещё нет
- какие шаблоны реально становятся reusable handoff assets
- достаточно ли ясна ownership boundary между людьми и клиентами
- какой commercial/support path нужен дальше

## Связанные материалы

- [ru-install-quickstart.md](./ru-install-quickstart.md)
- [ru-operator-quickstart.md](./ru-operator-quickstart.md)
- [RUNBOOK.md](../RUNBOOK.md)
- [COMMERCIAL-LICENSE.md](../COMMERCIAL-LICENSE.md)
