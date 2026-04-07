export const starterSmokeRoute = "/app/server-review";

export const starterSmokeChecks = [
  {
    label: "Server Review page title",
    pattern: 'data-testid="server-review-page-title"',
  },
  {
    label: "Server Review refresh button",
    pattern: 'data-testid="server-review-refresh"',
  },
  {
    label: "Server Review create card",
    pattern: 'data-testid="server-review-create-card"',
  },
  {
    label: "Primary queue search",
    pattern: 'data-testid="server-review-search"',
  },
  {
    label: "Server Review segment filter",
    pattern: 'data-testid="server-review-segment-filter"',
  },
];

export const starterSmokeFollowup = [
  "Keep this smoke aligned with the real queue-card based server-review page.",
  "Queue-card actions load from client data, so curl-based smoke should stay focused on static page markers.",
];
