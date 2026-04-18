# Операторский quickstart: первый deploy и handoff

Updated: 2026-04-18

Этот документ нужен не для “посмотреть демо”, а для реальной первой работы оператора внутри DeployMate.
Главная цель: пройти короткий маршрут `server -> deploy -> observe -> next safe action` и оставить после себя понятный handoff.

## 1. Не начинай с runtime, если Step 1 ещё не закрыт

Сначала открой `/app` и проверь, что главный CTA ведёт к настройке сервера, а не в случайные вторичные инструменты.

Если target ещё не сохранён:

1. иди в `/app/server-review`
2. сохрани один сервер
3. прогони connection check
4. только после этого открывай deploy flow

## 2. Первый deploy должен быть простым

В `/app/deployment-workflow`:

- сначала выбери image или один stack
- не открывай advanced setup без причины
- если есть готовый reusable template, проверь `context label` перед использованием
- если baseline чужой, сначала дублируй его в свой handoff-контекст, а не меняй напрямую

Цель первого прохода не “заполнить все поля”, а быстро получить один честный live runtime.

## 3. После deploy сразу открывай `Deployment passport`

Deployment detail должен отвечать прямо с верхнего блока:

- что запущено сейчас
- какой release trace у этого runtime
- есть ли health proof
- что происходило недавно
- какой следующий безопасный шаг
- кто реально может действовать

Если для ответа всё ещё нужно идти в сырой лог или вспоминать устный контекст, handoff ещё слабый.

## 4. Что проверить перед передачей сервиса другому оператору

- `Runtime identity`
- `Review target`
- `Release trace`
- `Health proof`
- `Recent activity`
- `Activity trail`
- `Attention`
- `Next safe action`
- `Ownership boundary`

Минимальный handoff считается удачным только тогда, когда другой человек может открыть passport и понять ситуацию без SSH-археологии.

## 5. Для агентств и интеграторов

- держи один `context label` на клиента, environment или тип handoff
- не используй чужой template как “общий по умолчанию” baseline для прямой мутации
- оставляй один главный review endpoint и один главный health target, а не набор равнозначных ссылок
- сохраняй reusable setup только тогда, когда он уже читается как понятный baseline для следующего оператора

## 6. Когда нужен business/support path

Иди в `/upgrade` или на `/commercial-license`, если:

- DeployMate уже идёт в live client delivery
- нужен paid internal-team path
- нужна поддержка, кастомизация или отдельные права
- нужен redistribution / white-label / managed-service сценарий

## Что читать дальше

- [ru-install-quickstart.md](./ru-install-quickstart.md) для первого self-hosted запуска
- [RUNBOOK.md](../RUNBOOK.md) для release и operator discipline
- [PRODUCT-STRATEGY.md](../PRODUCT-STRATEGY.md) если нужно быстро вспомнить продуктовый wedge
