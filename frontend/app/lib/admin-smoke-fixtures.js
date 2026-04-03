export const smokeMode = process.env.NEXT_PUBLIC_SMOKE_TEST_MODE === "1";
export const smokeRestoreReportMode =
  process.env.NEXT_PUBLIC_SMOKE_RESTORE_REPORT === "1";

export const smokeAdminUser = {
  id: "smoke-admin",
  username: "smoke-admin",
  is_admin: true,
  role: "admin",
  plan: "team",
};

export const smokeChangePasswordUser = {
  ...smokeAdminUser,
  must_change_password: true,
};

export const smokeUsers = [
  {
    id: "smoke-admin",
    username: "smoke-admin",
    role: "admin",
    plan: "team",
    must_change_password: false,
    created_at: "2026-04-02T00:00:00Z",
  },
  {
    id: "smoke-member",
    username: "smoke-member",
    role: "member",
    plan: "trial",
    must_change_password: true,
    created_at: "2026-04-02T00:03:00Z",
  },
];

export const smokeAdminOverview = {
  users: {
    total: 2,
    admins: 1,
    members: 1,
    trial: 1,
    solo: 0,
    team: 1,
    must_change_password: 1,
  },
  attention_items: [],
};

export const smokeAdminAuditEvents = [
  {
    id: "smoke-audit-1",
    action_type: "user.created",
    actor_username: "smoke-admin",
    target_type: "user",
    target_label: "smoke-admin",
    details: "Smoke test event",
    created_at: "2026-04-02T00:05:00Z",
  },
];

export const smokeUserSavedViews = [
  {
    id: "users-smoke-view",
    name: "Admins only",
    filters: {
      q: "",
      role: "admin",
      plan: "all",
      must_change_password: "all",
      audit_q: "",
    },
    updatedAt: "2026-04-02T00:10:00Z",
  },
];

export const smokeUserAuditViews = [
  {
    id: "users-audit-smoke-view",
    name: "User actions",
    filters: { audit_q: "", audit_scope: "user", audit_sort: "newest" },
    updatedAt: "2026-04-02T00:20:00Z",
  },
];

export const smokeRestoreBundle = {
  manifest: {
    version: "2026-04-01.backup-bundle.v1",
    bundle_name: "deploymate-backup-smoke",
    generated_at: "2026-04-02T00:30:00Z",
    sections: {
      users: 2,
      upgrade_requests: 1,
      audit_events: 3,
      servers: 1,
      deployment_templates: 1,
      deployments: 1,
    },
  },
  data: {
    users: [{ id: "smoke-admin" }, { id: "smoke-member" }],
    upgrade_requests: [{ id: "smoke-request-1" }],
    audit_events: [{ id: "smoke-audit-1" }],
    servers: [{ id: "smoke-server" }],
    deployment_templates: [{ id: "smoke-template" }],
    deployments: [{ id: "smoke-deployment" }],
  },
};

export const smokeRestoreDryRun = {
  manifest: smokeRestoreBundle.manifest,
  summary: {
    total_sections: 6,
    total_records: 9,
    blocker_count: 2,
    warning_count: 3,
    ok_sections: 2,
    review_required_sections: 2,
    blocked_sections: 2,
    readiness_status: "blocked",
    next_step: "Do not plan a live import yet. Resolve the blocked sections first, then rerun dry-run validation.",
    plain_language_summary:
      "This backup is not ready for any real import work yet because 2 sections are blocked: servers, deployments.",
    highest_risk_sections: ["servers", "deployments", "users"],
    preparation_summary:
      "Preparation mix: 1 ready to document for import preparation, 2 still need merge review, 1 are validation-only, 2 should stay dry-run only",
    validate_only_sections: 1,
    merge_review_sections: 2,
    prepare_import_sections: 1,
    dry_run_only_sections: 2,
  },
  sections: [
    {
      name: "users",
      status: "warn",
      preparation_mode: "merge_review",
      recommended_action:
        "Review users as merge candidates only. Preserve credential and password-reset state rather than planning blind overwrite.",
      incoming_count: 2,
      current_count: 2,
      blockers: [],
      warnings: [
        {
          severity: "warn",
          code: "user-conflicts",
          message: "Two users already exist and need merge review.",
        },
      ],
      notes: ["Users can be validated safely before any controlled import."],
    },
    {
      name: "upgrade_requests",
      status: "ok",
      preparation_mode: "prepare_import",
      recommended_action:
        "This section looks clean enough to document as an import-preparation candidate, while final apply stays manual.",
      incoming_count: 1,
      current_count: 1,
      blockers: [],
      warnings: [],
      notes: ["Upgrade requests look low-risk for a future import plan."],
    },
    {
      name: "audit_events",
      status: "ok",
      preparation_mode: "validate_only",
      recommended_action:
        "Validate audit event shape and deduplication needs, but keep this section low priority for any future import preparation.",
      incoming_count: 3,
      current_count: 4,
      blockers: [],
      warnings: [],
      notes: ["Audit history is append-only and mostly informational."],
    },
    {
      name: "servers",
      status: "error",
      preparation_mode: "dry_run_only",
      recommended_action:
        "Do not prepare server import yet. Resolve identity, trust, and target conflicts first, then rerun dry-run.",
      incoming_count: 1,
      current_count: 1,
      blockers: [
        {
          severity: "error",
          code: "server-credentials-changed",
          message: "Server credentials and host trust must be reviewed before any import.",
        },
      ],
      warnings: [],
      notes: ["Remote targets are sensitive because infrastructure may have changed."],
    },
    {
      name: "deployment_templates",
      status: "warn",
      preparation_mode: "merge_review",
      recommended_action:
        "Clean up warnings and linking drift in this section, then rerun dry-run before moving into import preparation.",
      incoming_count: 1,
      current_count: 2,
      blockers: [],
      warnings: [
        {
          severity: "warn",
          code: "template-name-conflict",
          message: "One template name already exists and needs cleanup.",
        },
        {
          severity: "warn",
          code: "template-server-drift",
          message: "Template server bindings should be reviewed against current targets.",
        },
      ],
      notes: ["Templates are good import candidates after conflict cleanup."],
    },
    {
      name: "deployments",
      status: "error",
      preparation_mode: "dry_run_only",
      recommended_action:
        "Keep deployments in dry-run only. Use this section for runtime review and manual rebuild planning instead of any future direct import.",
      incoming_count: 1,
      current_count: 1,
      blockers: [
        {
          severity: "error",
          code: "runtime-sensitive",
          message: "Deployment restore stays dry-run only because runtime state cannot be replayed safely.",
        },
      ],
      warnings: [],
      notes: ["Deployment restore remains the riskiest section in the bundle."],
    },
  ],
};

export const smokeRestoreImportPlan = {
  generated_at: "2026-04-02T00:40:00Z",
  dry_run_generated_at: "2026-04-02T00:35:00Z",
  manifest: smokeRestoreBundle.manifest,
  summary: {
    plan_id: "import-plan-smoke",
    plan_status: "blocked",
    apply_allowed: false,
    plan_scope_summary:
      "Controlled import scope: include upgrade_requests; hold users, deployment_templates for review; block servers; exclude audit_events, deployments",
    reviewer_guidance:
      "This plan is for operator review only. It narrows future import scope without authorizing any live restore apply.",
    typed_confirmation_phrase: "review import plan deploymate-backup-smoke",
    included_sections: ["upgrade_requests"],
    review_sections: ["users", "deployment_templates"],
    blocked_sections: ["servers"],
    excluded_sections: ["audit_events", "deployments"],
  },
  sections: [
    {
      name: "users",
      source_status: "warn",
      preparation_mode: "merge_review",
      plan_state: "review",
      include_in_plan: false,
      rationale: "This section still needs operator review and cleanup before it can be considered for any import scope.",
      recommended_action:
        "Review users as merge candidates only. Preserve credential and password-reset state rather than planning blind overwrite.",
    },
    {
      name: "upgrade_requests",
      source_status: "ok",
      preparation_mode: "prepare_import",
      plan_state: "include",
      include_in_plan: true,
      rationale: "This section can be carried into a controlled import plan, but final apply still stays manual.",
      recommended_action:
        "This section looks clean enough to document as an import-preparation candidate, while final apply stays manual.",
    },
    {
      name: "audit_events",
      source_status: "ok",
      preparation_mode: "validate_only",
      plan_state: "exclude",
      include_in_plan: false,
      rationale: "This section is useful for validation and context, but it should not be part of an import scope.",
      recommended_action:
        "Validate audit event shape and deduplication needs, but keep this section low priority for any future import preparation.",
    },
    {
      name: "servers",
      source_status: "error",
      preparation_mode: "dry_run_only",
      plan_state: "blocked",
      include_in_plan: false,
      rationale: "This section must stay outside any future apply scope until the underlying runtime or safety risk is resolved.",
      recommended_action:
        "Do not prepare server import yet. Resolve identity, trust, and target conflicts first, then rerun dry-run.",
    },
    {
      name: "deployment_templates",
      source_status: "warn",
      preparation_mode: "merge_review",
      plan_state: "review",
      include_in_plan: false,
      rationale: "This section still needs operator review and cleanup before it can be considered for any import scope.",
      recommended_action:
        "Clean up warnings and linking drift in this section, then rerun dry-run before moving into import preparation.",
    },
    {
      name: "deployments",
      source_status: "error",
      preparation_mode: "dry_run_only",
      plan_state: "exclude",
      include_in_plan: false,
      rationale: "This section must stay outside any future apply scope until the underlying runtime or safety risk is resolved.",
      recommended_action:
        "Keep deployments in dry-run only. Use this section for runtime review and manual rebuild planning instead of any future direct import.",
    },
  ],
};

export const smokeUpgradeRequests = [
  {
    id: "smoke-request-1",
    status: "in_review",
    name: "Smoke Team",
    email: "ops@example.com",
    company_or_team: "Smoke Team",
    use_case: "Smoke validation",
    current_plan: "trial",
    handled_by_username: "smoke-admin",
    target_username: "smoke-admin",
    target_user_id: "smoke-admin",
    reviewed_at: "2026-04-02T00:05:00Z",
    updated_at: "2026-04-02T00:05:00Z",
    created_at: "2026-04-02T00:00:00Z",
    internal_note: "Smoke test note",
  },
];

export const smokeUpgradeOverview = {
  upgrade_requests: {
    total: 1,
    new: 0,
    in_review: 1,
    approved: 0,
    rejected: 0,
    closed: 0,
    linked_users: 1,
  },
  attention_items: [],
};

export const smokeUpgradeAuditEvents = [
  {
    id: "smoke-upgrade-audit-1",
    action_type: "upgrade_request.updated",
    actor_username: "smoke-admin",
    target_label: "Smoke Team",
    details: "Smoke Team approved during smoke verification.",
    created_at: "2026-04-02T00:06:00Z",
  },
];

export const smokeUpgradeUsers = [
  { id: "smoke-admin", username: "smoke-admin", plan: "team" },
];

export const smokeUpgradeSavedViews = [
  {
    id: "upgrade-smoke-view",
    name: "In review queue",
    filters: {
      q: "",
      plan: "all",
      status: "in_review",
      linked_only: false,
      audit_q: "",
    },
    updatedAt: "2026-04-02T00:12:00Z",
  },
];

export const smokeUpgradeAuditViews = [
  {
    id: "upgrade-audit-smoke-view",
    name: "Newest approvals",
    filters: { audit_q: "approved", audit_sort: "newest" },
    updatedAt: "2026-04-02T00:22:00Z",
  },
];
