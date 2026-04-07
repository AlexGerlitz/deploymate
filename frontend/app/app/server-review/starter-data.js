export const starterMetrics = [
  {
    label: "Step 1",
    value: "Connect server",
    description: "Save one server first, then check that DeployMate can reach it.",
  },
  {
    label: "Step 2",
    value: "Check connection",
    description: "Use connection test or diagnostics only to remove uncertainty before the first app setup.",
  },
  {
    label: "Later",
    value: "Advanced tools",
    description: "Tables, bulk tools, audit, and exports stay secondary until one server is clearly ready.",
  },
];
export const segmentFilterOptions = [
  { value: "all", label: "All servers" },
  { value: "diagnostics", label: "Needs checks" },
  { value: "ready", label: "Ready" },
  { value: "auth", label: "Needs key fix" },
];
export const bulkStatusOptions = [
  { value: "diagnostics_running", label: "Diagnostics follow-up" },
  { value: "ssh_ready", label: "SSH ready" },
  { value: "needs_auth_review", label: "Needs auth review" },
];

export const starterStrings = {
  searchPlaceholder: "Search by server name, host, or status",
  queueTitle: "Saved servers",
  queueDescription: "Save a server, check the connection, and keep one clear path into app setup.",
  summaryTitle: "Step 1: Connect your server",
  summaryDescription: "This page is for one beginner task first: save a server and confirm that DeployMate can reach it.",
  spotlightBody: "Use this page to connect one server, remove uncertainty, and then continue into app setup only after one server is understood.",
  segmentFilterLabel: "Show",
  segmentFilterDefault: "all",
  cardMetaLabel: "Connection details",
  actionSectionTitle: "Check the selected server",
  actionSectionDescription: "Use one action to answer the only question that matters here: can DeployMate reach this server and is it ready for the next step?",
  actionFocusHint: "This page is strongest when you leave knowing whether the selected server is ready, blocked, or needs a quick fix.",
  actionNotePlaceholder: "Optional note about what you checked or what still needs fixing.",
  primaryActionLabel: "Run full check",
  secondaryActionLabel: "Test connection",
  bulkSectionTitle: "Bulk follow-up labels",
  bulkSectionDescription: "Bulk actions here stay lightweight on purpose. Use them to label a review pass after you understand the real server state.",
  bulkPresetOneLabel: "Select diagnostics slice",
  bulkPresetOneSegment: "diagnostics",
  bulkPresetTwoLabel: "Select auth review slice",
  bulkPresetTwoSegment: "auth",
  bulkApplyLabel: "Apply local follow-up label",
  mutationRouteLabel: "GET /servers/{id}/diagnostics or POST /servers/{id}/test",
};

export const starterTableColumns = [
  { key: "label", label: "Server" },
  { key: "status", label: "Status" },
  { key: "meta", label: "Connection details" },
  { key: "segment", label: "Show" },
];

export const starterRuntimeMode = "api";
