export const starterMetrics = [
  {
    label: "Primary review",
    value: "Connectivity",
    description: "Start with one useful list plus diagnostics or connection-status action.",
  },
  {
    label: "Secondary",
    value: "Ports",
    description: "Suggested ports and deeper diagnostics come after the first server review action works.",
  },
  {
    label: "Later",
    value: "Audit/export",
    description: "Audit and exports should support operations handoff, not distract from first-pass connectivity work.",
  },
];
export const segmentFilterOptions = [
  { value: "all", label: "All review focus" },
  { value: "diagnostics", label: "Diagnostics" },
  { value: "ready", label: "Ready" },
  { value: "auth", label: "Auth review" },
];
export const bulkStatusOptions = [
  { value: "diagnostics_running", label: "Diagnostics follow-up" },
  { value: "ssh_ready", label: "SSH ready" },
  { value: "needs_auth_review", label: "Needs auth review" },
];

export const starterStrings = {
  searchPlaceholder: "Search server name, auth type, or diagnostics state",
  queueTitle: "Current server slice",
  queueDescription: "Review live saved server targets, then run the next meaningful action without leaving the page.",
  summaryTitle: "Server review shape",
  summaryDescription: "This page is for checking real saved targets: who needs diagnostics, who is ready, and who still needs auth review.",
  spotlightBody: "Use this surface to review real servers quickly, confirm connectivity, and keep suggested next ports visible during the same pass.",
  segmentFilterLabel: "Review focus",
  segmentFilterDefault: "all",
  cardMetaLabel: "Server context",
  actionSectionTitle: "Live server actions",
  actionSectionDescription: "Use the first action path to remove uncertainty: run diagnostics or test the connection on the selected server.",
  actionFocusHint: "The point is to leave the page knowing whether the server is ready, blocked, or still needs auth review.",
  actionNotePlaceholder: "Capture the operator note that explains why this server was checked.",
  primaryActionLabel: "Run diagnostics",
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
  { key: "label", label: "Queue item" },
  { key: "status", label: "Status" },
  { key: "meta", label: "Server context" },
  { key: "segment", label: "Ops focus" },
];

export const starterRuntimeMode = "api";
