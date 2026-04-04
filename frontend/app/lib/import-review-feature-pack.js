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
    workspace.import_plan.summary.approval_packet_title || `Import review approval for ${workspace.bundle_manifest.bundle_name}`,
    "",
    `Bundle: ${workspace.bundle_manifest.bundle_name}`,
    `Plan ID: ${workspace.import_plan.summary.plan_id}`,
    `Approval status: ${workspace.import_plan.summary.approval_status}`,
    "",
    "## Share Summary",
    "",
    workspace.import_plan.summary.approval_share_summary || "No share summary available.",
    "",
    "## Subject Line",
    "",
    workspace.import_plan.summary.approval_subject_line || "No subject line available.",
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
  lines.push("", "## Next Step", "", workspace.import_plan.summary.approval_next_step || "No next step available.");

  return lines.join("\n");
}

export function buildImportReviewApprovalTrail(workspace) {
  if (!workspace) {
    return null;
  }

  return {
    generated_at: workspace.generated_at,
    bundle_name: workspace.bundle_manifest.bundle_name,
    source_generated_at: workspace.bundle_manifest.generated_at,
    dry_run_readiness: workspace.dry_run.summary.readiness_status,
    plan_status: workspace.import_plan.summary.plan_status,
    plan_id: workspace.import_plan.summary.plan_id,
    approval_status: workspace.import_plan.summary.approval_status,
    approval_packet_title: workspace.import_plan.summary.approval_packet_title,
    approval_subject_line: workspace.import_plan.summary.approval_subject_line,
    approval_share_summary: workspace.import_plan.summary.approval_share_summary,
    approval_decision_question: workspace.import_plan.summary.approval_decision_question,
    approval_summary: workspace.import_plan.summary.approval_summary,
    approval_handoff_note: workspace.import_plan.summary.approval_handoff_note,
    approval_next_step: workspace.import_plan.summary.approval_next_step,
    plan_scope_summary: workspace.import_plan.summary.plan_scope_summary,
    reviewer_guidance: workspace.import_plan.summary.reviewer_guidance,
    typed_confirmation_phrase: workspace.import_plan.summary.typed_confirmation_phrase,
    included_sections: workspace.import_plan.summary.included_sections || [],
    review_sections: workspace.import_plan.summary.review_sections || [],
    blocked_sections: workspace.import_plan.summary.blocked_sections || [],
    excluded_sections: workspace.import_plan.summary.excluded_sections || [],
  };
}

export function buildImportReviewPreparationPacket(workspace) {
  if (!workspace) {
    return "";
  }

  const lines = [
    "# Controlled Preparation Handoff",
    "",
    workspace.import_plan.summary.preparation_packet_title || `Controlled preparation handoff for ${workspace.bundle_manifest.bundle_name}`,
    "",
    `Bundle: ${workspace.bundle_manifest.bundle_name}`,
    `Plan ID: ${workspace.import_plan.summary.plan_id}`,
    `Preparation status: ${workspace.import_plan.summary.preparation_status}`,
    "",
    "## Share Summary",
    "",
    workspace.import_plan.summary.preparation_share_summary || "No preparation share summary available.",
    "",
    "## Summary",
    "",
    workspace.import_plan.summary.preparation_summary || "No preparation summary available.",
    "",
    "## Handoff Note",
    "",
    workspace.import_plan.summary.preparation_handoff_note || "No preparation handoff note available.",
    "",
    "## Checklist",
    "",
  ];

  if (!(workspace.import_plan.summary.preparation_checklist || []).length) {
    lines.push("- No preparation checklist items available.");
  } else {
    for (const item of workspace.import_plan.summary.preparation_checklist) {
      lines.push(`- ${item}`);
    }
  }

  lines.push("", "## Scope", "", workspace.import_plan.summary.plan_scope_summary || "No scope summary available.");
  lines.push("", "## Next Step", "", workspace.import_plan.summary.preparation_next_step || "No preparation next step available.");

  return lines.join("\n");
}

export function buildImportReviewPreparationTrail(workspace) {
  if (!workspace) {
    return null;
  }

  return {
    generated_at: workspace.generated_at,
    bundle_name: workspace.bundle_manifest.bundle_name,
    plan_id: workspace.import_plan.summary.plan_id,
    preparation_status: workspace.import_plan.summary.preparation_status,
    preparation_packet_title: workspace.import_plan.summary.preparation_packet_title,
    preparation_share_summary: workspace.import_plan.summary.preparation_share_summary,
    preparation_summary: workspace.import_plan.summary.preparation_summary,
    preparation_handoff_note: workspace.import_plan.summary.preparation_handoff_note,
    preparation_next_step: workspace.import_plan.summary.preparation_next_step,
    preparation_checklist: workspace.import_plan.summary.preparation_checklist || [],
    plan_scope_summary: workspace.import_plan.summary.plan_scope_summary,
    reviewer_guidance: workspace.import_plan.summary.reviewer_guidance,
    included_sections: workspace.import_plan.summary.included_sections || [],
    review_sections: workspace.import_plan.summary.review_sections || [],
    blocked_sections: workspace.import_plan.summary.blocked_sections || [],
    excluded_sections: workspace.import_plan.summary.excluded_sections || [],
  };
}
