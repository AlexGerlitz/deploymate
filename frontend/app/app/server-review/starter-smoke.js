export const starterSmokeRoute = "/app/server-review";

export const starterSmokeChecks = [
  {
    label: "Server Review page title",
    pattern: 'data-testid="server-review-page-title"',
  },
  {
    label: "Primary queue search",
    pattern: 'data-testid="server-review-search"',
  },
  {
    label: "Review table starter",
    pattern: 'data-testid="server-review-table"',
  },
  {
    label: "Starter action panel",
    pattern: 'data-testid="server-review-action-starter"',
  },
  {
    label: "Starter bulk panel",
    pattern: 'data-testid="server-review-bulk-starter"',
  },
  {
    label: "Starter mutation preview",
    pattern: 'data-testid="server-review-mutation-starter"',
  },
];

export const starterSmokeFollowup = [
  "Add this surface route to scripts/project_automation_smoke_checks.sh once the feature is real.",
  "Promote the starter checks into a dedicated smoke only after the page stops being scaffold-only.",
];