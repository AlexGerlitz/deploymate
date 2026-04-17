export const FUNNEL_TELEMETRY_SCHEMA_VERSION = 1;

export const FUNNEL_EVENT_NAMES = Object.freeze({
  LANDING_CTA: "landing_cta",
  REGISTER_STARTED: "register_started",
  REGISTER_COMPLETED: "register_completed",
  SERVER_CREATED: "server_created",
  SERVER_VERIFIED: "server_verified",
  DEPLOYMENT_CREATED: "deployment_created",
  HEALTHY_REACHED: "healthy_reached",
  DEPLOYMENT_DETAIL_OPENED: "deployment_detail_opened",
});

export function trackFunnelEvent(name, detail = {}) {
  if (typeof window === "undefined" || !name) {
    return;
  }

  const payload = {
    event: "deploymate_funnel_event",
    funnel_event_name: name,
    funnel_schema_version: FUNNEL_TELEMETRY_SCHEMA_VERSION,
    path: window.location.pathname,
    occurred_at: new Date().toISOString(),
    ...detail,
  };

  window.dispatchEvent(
    new CustomEvent("deploymate:funnel-event", {
      detail: payload,
    }),
  );

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(payload);
  }
}
