# Design-partner demo packet для DeployMate

Updated: 2026-04-18

Этот пакет нужен для первого серьёзного buyer/design-partner разговора.
Его задача не “показать побольше экранов”, а быстро доказать одну вещь:
DeployMate помогает ongoing-support команде вести сервис на client-owned или self-owned инфраструктуре без SSH-ритуалов и потери handoff-контекста.

## Что должен понять человек за 10-15 минут

- продукт не про “ещё одну панель”, а про ясный путь `server -> deploy -> observe -> next safe action`
- основной wedge это агентства, интеграторы и support-команды
- runtime можно передать другому оператору без устного архива в чате
- self-hosted path уже выглядит как рабочий pilot, а не как обещание на будущее

## Как вести демо

### 1. Открыть public story

Сначала открой:

- `/`
- `/upgrade`
- `/commercial-license`

Что доказать на этом шаге:

- buyer path уже разделён на `Internal Team`, `Agency / Multi-client`, `Custom / Redistribution`
- коммерческий путь завязан на infrastructure type, support model и handoff, а не на абстрактные seat-ы
- есть русскоязычные install/operator/pilot материалы, а не только маркетинговый текст

### 2. Показать, что это не brochure

Открой live product entry:

- `/login`
- при необходимости `/register` или demo access

Что доказать:

- это уже не статическая витрина
- у продукта есть живой вход, рабочий app shell и нормальный первый маршрут

### 3. Показать Step 1: server review

Открой `/app/server-review`.

Что доказать:

- target инфраструктуры виден явно
- connection check живёт в продукте, а не только в shell
- первый deploy начинается с одного подтверждённого target, а не со свалки опций

### 4. Показать Step 2: deploy workflow

Открой `/app/deployment-workflow`.

Что доказать:

- первый deploy можно сделать через понятный guided flow
- stack/compose уже не выпадает из продукта как “потом разберёмся”
- reusable templates читаются как handoff assets, а не как личные пресеты автора

### 5. Показать главное: Deployment passport

Открой один `deployment detail`.

Что доказать прямо на экране:

- `Runtime identity`
- `Review target`
- `Release trace`
- `Health proof`
- `Recent activity`
- `Activity trail`
- `Attention`
- `Next safe action`
- `Recovery path`
- `Ownership boundary`

Это главный момент всего демо.
Если buyer видит, что другой оператор сможет открыть страницу и быстро понять состояние сервиса, основной wedge уже доказан.

### 6. Показать границу agency fit

Если уместно, покажи template reuse и `context label`.

Что доказать:

- handoff asset может жить в client/environment контексте
- чужой baseline не должен мутироваться как “общий”
- продукт поддерживает multi-client мышление без превращения в тяжёлую платформу

## Какие вопросы задать после демо

- где у команды сегодня теряется handoff-контекст
- кто обычно знает “что реально крутится сейчас”
- сколько сервисов и серверов реально в support-контуре
- это internal-team path или client-delivery path
- нужен ли только pilot, или уже support/customization/commercial agreement

## Что отправить после демо

Если интерес живой, отправляй не общий “созвонимся потом”, а конкретный packet:

- [ru-install-quickstart.md](./ru-install-quickstart.md)
- [ru-operator-quickstart.md](./ru-operator-quickstart.md)
- [ru-pilot-onboarding-checklist.md](./ru-pilot-onboarding-checklist.md)
- [COMMERCIAL-LICENSE.md](../COMMERCIAL-LICENSE.md)

## Как понять, что демо было удачным

После разговора человек может своими словами объяснить:

- что это за продукт
- для кого он
- почему он полезнее, чем `Docker + SSH + память одного инженера`
- как выглядел бы первый pilot на их инфраструктуре

Если без автора это объяснить нельзя, значит demo packet ещё слабый.
