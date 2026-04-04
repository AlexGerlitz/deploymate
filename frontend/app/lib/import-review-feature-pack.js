import { escapeCsvCell } from "./admin-page-utils";

export const importReviewFeatureRoute = "/app/import-review";
export const importReviewHandoffStorageKey = "deploymate.admin.importReview.handoff";

export function buildImportReviewHandoffPayload(workspace) {
  if (!workspace) {
    return null;
  }

  return {
    source: "restore_workspace",
    stored_at: new Date().toISOString(),
    workspace,
  };
}

export function buildImportReviewCsv(sections = []) {
  const rows = [[
    "section",
    "plan_state",
    "preparation_mode",
    "include_in_plan",
    "rationale",
    "recommended_action",
  ]];

  for (const section of sections) {
    rows.push([
      section.name || "",
      section.plan_state || "",
      section.preparation_mode || "",
      section.include_in_plan ? "yes" : "no",
      section.rationale || "",
      section.recommended_action || "",
    ]);
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function buildImportReviewMarkdown(workspace) {
  if (!workspace) {
    return "";
  }

  const lines = [
    "# Import Review",
    "",
    `Bundle: ${workspace.bundle_manifest.bundle_name}`,
    `Generated: ${workspace.generated_at}`,
    `Dry-run readiness: ${workspace.dry_run.summary.readiness_status}`,
    `Plan status: ${workspace.import_plan.summary.plan_status}`,
    `Apply allowed: ${workspace.import_plan.summary.apply_allowed ? "yes" : "no"}`,
    "",
    "## Apply Boundary",
    "",
    workspace.import_plan.summary.apply_block_reason || "No apply block reason available.",
    "",
    workspace.import_plan.summary.boundary_message || "No boundary message available.",
    "",
    "## Apply Readiness Review",
    "",
    workspace.import_plan.summary.apply_readiness_summary || "No apply readiness summary available.",
    "",
    `Typed review phrase: ${workspace.import_plan.summary.typed_review_phrase || "N/A"}`,
    "",
    "## Approval Packet",
    "",
    `Approval status: ${workspace.import_plan.summary.approval_status || "unknown"}`,
    "",
    workspace.import_plan.summary.approval_summary || "No approval summary available.",
    "",
    workspace.import_plan.summary.approval_decision_question || "No approval question available.",
    "",
    workspace.import_plan.summary.approval_handoff_note || "No approval handoff note available.",
    "",
    "## Scope Summary",
    "",
    workspace.import_plan.summary.plan_scope_summary || "No scope summary available.",
    "",
    "## Reviewer Guidance",
    "",
    workspace.import_plan.summary.reviewer_guidance || "No reviewer guidance available.",
    "",
    "## Typed Confirmation",
    "",
    workspace.import_plan.summary.typed_confirmation_phrase || "No confirmation phrase available.",
    "",
    "## Sections",
    "",
  ];

  for (const section of workspace.import_plan.sections || []) {
    lines.push(`- ${section.name}: ${section.plan_state}`);
    lines.push(`  preparation mode: ${section.preparation_mode || "unknown"}`);
    lines.push(`  include in plan: ${section.include_in_plan ? "yes" : "no"}`);
    lines.push(`  rationale: ${section.rationale || "No rationale available."}`);
    lines.push(`  recommended action: ${section.recommended_action || "No recommended action available."}`);
  }

  return lines.join("\n");
}

export function buildImportReviewApprovalPacket(workspace) {
  if (!workspace) {
    return "";
  }

  const lines = [
    "# Import Review Approval Packet",
    "",
    `Bundle: ${workspace.bundle_manifest.bundle_name}`,
    `Plan ID: ${workspace.import_plan.summary.plan_id}`,
    `Approval status: ${workspace.import_plan.summary.approval_status}`,
    "",
    "## Decision Question",
    "",
    workspace.import_plan.summary.approval_decision_question || "No decision question available.",
    "",
    "## Summary",
    "",
    workspace.import_plan.summary.approval_summary || "No approval summary available.",
    "",
    "## Handoff Note",
    "",
    workspace.import_plan.summary.approval_handoff_note || "No handoff note available.",
    "",
    "## Checklist",
    "",
  ];

  if (!(workspace.import_plan.summary.approval_checklist || []).length) {
    lines.push("- No checklist items available.");
  } else {
    for (const item of workspace.import_plan.summary.approval_checklist) {
      lines.push(`- ${item}`);
    }
  }

  lines.push("", "## Scope", "", workspace.import_plan.summary.plan_scope_summary || "No scope summary available.");

  return lines.join("\n");
}
