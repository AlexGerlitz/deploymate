import Link from "next/link";

import TrackedLink from "../tracked-link";
import { FUNNEL_EVENT_NAMES } from "../lib/funnel-telemetry";

const habrReaderSignals = [
  {
    label: "Кому это нужно",
    title: "Агентствам, интеграторам и support-командам, которые ведут сервисы на инфраструктуре клиента или своей инфраструктуре.",
  },
  {
    label: "В чём ценность",
    title: "Не просто задеплоить сервис, а передать его следующему человеку без SSH-археологии, чатов и памяти одного инженера.",
  },
  {
    label: "Чего тут нет",
    title: "Это не Kubernetes-платформа и не generic cloud dashboard. Главный путь — server -> deploy -> observe -> next safe action.",
  },
];

const habrProofCards = [
  {
    label: "Live product",
    title: "Уже есть живой путь от server review до deployment passport.",
    detail:
      "Можно зайти в продукт, подключить сервер, открыть guided deploy flow, посмотреть runtime и handoff-артефакт без отдельной демо-сборки.",
  },
  {
    label: "Operator proof",
    title: "Есть русскоязычные материалы для install, operator path и первого пилота.",
    detail:
      "Это не только лендинг. Уже лежат install quickstart, operator quickstart, pilot onboarding checklist и demo packet.",
  },
  {
    label: "Buyer path",
    title: "Есть понятный коммерческий вход, а не только “напишите в личку”.",
    detail:
      "Страница evaluation / commercial path уже разделяет trial, internal-team use, agency delivery и custom licensing.",
  },
];

const habrActions = [
  {
    label: "1. Посмотреть продукт",
    detail:
      "Открыть живой продукт и увидеть главный путь: overview, server review, deployment workflow и runtime detail.",
    href: "/login",
    cta: "Открыть live product",
  },
  {
    label: "2. Понять упаковку",
    detail:
      "Если продукт нужен для клиентской инфраструктуры и ongoing support, идти не в trial ради trial, а в buyer path.",
    href: "/upgrade",
    cta: "Открыть business path",
  },
  {
    label: "3. Проверить proof",
    detail:
      "Открыть русские operator/pilot материалы и понять, как выглядит install, handoff и первый пилот без догадок.",
    href: "https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-design-partner-demo-packet.md",
    cta: "Открыть demo packet",
  },
];

const habrMaterials = [
  {
    label: "Russian install quickstart",
    href: "https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-install-quickstart.md",
    detail: "Первый self-hosted install path на VPS или dedicated host.",
  },
  {
    label: "Russian operator quickstart",
    href: "https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-operator-quickstart.md",
    detail: "Маршрут от server review до deployment passport и handoff.",
  },
  {
    label: "Russian pilot onboarding checklist",
    href: "https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-pilot-onboarding-checklist.md",
    detail: "Что именно происходит в первую неделю пилота.",
  },
  {
    label: "Russian design-partner demo packet",
    href: "https://github.com/AlexGerlitz/deploymate/blob/main/docs/ru-design-partner-demo-packet.md",
    detail: "Как показывать продукт покупателю за 10-15 минут.",
  },
];

export default function HabrPage() {
  return (
    <main className="landingPage">
      <section className="landingTopbar">
        <div className="container landingTopbarInner">
          <Link href="/" className="landingBrand">
            <span className="landingBrandMark">DM</span>
            <span className="landingBrandText">
              <strong>DeployMate</strong>
              <span className="landingBrandSub">Habr reader path</span>
            </span>
          </Link>
          <div className="buttonRow">
            <Link href="/" className="landingButton ghostButton">
              Главная
            </Link>
            <Link href="/commercial-license" className="landingButton ghostButton">
              Commercial
            </Link>
            <Link href="/login" className="landingButton secondaryButton">
              Live product
            </Link>
          </div>
        </div>
      </section>

      <section className="landingHero">
        <div className="container landingShell">
          <div className="landingHeroGrid">
            <div className="landingHeroCopy">
              <div className="eyebrow">Для читателей Хабра</div>
              <h1>Если вы пришли из статьи, вот короткий путь без маркетингового тумана.</h1>
              <p className="landingLead">
                DeployMate нужен не для того, чтобы просто “задеплоить Docker”.
                Его смысл в другом: сделать эксплуатацию, runtime review и handoff
                на client-owned или self-owned infrastructure настолько понятными,
                чтобы следующий инженер продолжил работу без SSH-ритуалов и потери контекста.
              </p>

              <div className="landingHeroSummary">
                <div className="heroSummaryCard">
                  <span className="heroSummaryLabel">Что смотреть первым</span>
                  <strong>Server review, guided deploy flow и deployment passport.</strong>
                </div>
                <div className="heroSummaryCard">
                  <span className="heroSummaryLabel">Что не надо ожидать</span>
                  <strong>Мы не продаём “AI всё сделает сам” и не строим новый Kubernetes.</strong>
                </div>
              </div>

              <div className="landingPathGrid">
                {habrActions.map((item) => (
                  <article key={item.label} className="landingPathCard">
                    <span className="heroSummaryLabel">{item.label}</span>
                    <strong>{item.cta}</strong>
                    <p>{item.detail}</p>
                    <TrackedLink
                      href={item.href}
                      className="landingButton secondaryButton"
                      eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                      eventProps={{ surface: "habr_reader_path", cta: item.cta }}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                    >
                      {item.cta}
                    </TrackedLink>
                  </article>
                ))}
              </div>

              <div className="buttonRow">
                <TrackedLink
                  href="/login"
                  className="landingButton primaryButton"
                  eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                  eventProps={{ surface: "habr_hero", cta: "open_live_product" }}
                >
                  Открыть live product
                </TrackedLink>
                <TrackedLink
                  href="/upgrade"
                  className="landingButton secondaryButton landingSecondaryCta"
                  eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                  eventProps={{ surface: "habr_hero", cta: "open_business_path" }}
                >
                  Открыть evaluation / pilot path
                </TrackedLink>
              </div>

              <div className="landingHeroNote">
                <strong>Лучший сценарий после статьи:</strong>
                сначала открыть живой продукт, потом buyer path, потом русские operator/pilot материалы. Не наоборот.
              </div>

              <div className="landingSignalRail">
                {habrReaderSignals.map((item) => (
                  <article key={item.label} className="landingSignalCard">
                    <span>{item.label}</span>
                    <strong>{item.title}</strong>
                  </article>
                ))}
              </div>
            </div>

            <div className="landingShowcase">
              <article className="showcaseFrame">
                <div className="showcaseTopline">
                  <span className="showcaseChip">Reader checklist</span>
                  <span className="showcaseLive">ready</span>
                </div>
                <div className="showcaseQuickTake">
                  <strong>Что должно стать понятно за 10 минут</strong>
                  <p>
                    Продукт уже даёт не только deploy action, но и readable runtime story:
                    что сейчас запущено, здорово ли оно, что изменилось и какой следующий безопасный шаг.
                  </p>
                </div>

                <div className="showcasePanels">
                  {habrProofCards.map((item) => (
                    <div key={item.label} className="showcasePanel">
                      <div className="showcasePanelHeader">
                        <strong>{item.title}</strong>
                        <span className="status ok">{item.label}</span>
                      </div>
                      <p>{item.detail}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>

          <section className="landingSection">
            <div className="sectionIntro sectionIntroWide">
              <div className="eyebrow">Материалы</div>
              <h2>Что приложить к статье и куда вести людей дальше</h2>
              <p className="sectionLead">
                Из статьи лучше вести в конкретный продуктовый маршрут, а не просто на главную.
                Поэтому ниже уже собран нормальный набор ссылок для живого buyer/operator path.
              </p>
            </div>

            <div className="overviewGrid">
              {habrMaterials.map((item) => (
                <article key={item.label} className="overviewCard">
                  <span className="overviewLabel">{item.label}</span>
                  <div className="overviewMeta">
                    <span>{item.detail}</span>
                    <span>
                      <a href={item.href} className="inlineLink" target="_blank" rel="noreferrer">
                        Открыть материал
                      </a>
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="buttonRow">
              <TrackedLink
                href="/upgrade"
                className="landingButton primaryButton"
                eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                eventProps={{ surface: "habr_footer", cta: "pilot_path" }}
              >
                Перейти в pilot / business path
              </TrackedLink>
              <TrackedLink
                href="/commercial-license"
                className="landingButton secondaryButton"
                eventName={FUNNEL_EVENT_NAMES.LANDING_CTA}
                eventProps={{ surface: "habr_footer", cta: "commercial_path" }}
              >
                Посмотреть commercial path
              </TrackedLink>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
