import { escapeCsvCell } from "./admin-page-utils";

function formatPreparationMode(mode) {
  return String(mode || "")
    .split("_")
    .filter(Boolean)
    .join(" ");
}

export function buildRestoreDryRunCsv(report) {
  const rows = [
    ["section", "status", "preparation_mode", "recommended_action", "incoming_count", "current_count", "issue_type", "code", "message"],
  ];

  for (const section of report.sections || []) {
    if (!section.blockers.length && !section.warnings.length) {
      rows.push([
        section.name,
        section.status,
        formatPreparationMode(section.preparation_mode),
        section.recommended_action || "",
        section.incoming_count,
        section.current_count,
        "note",
        "",
        (section.notes || []).join(" | "),
      ]);
      continue;
    }

    for (const issue of section.blockers || []) {
      rows.push([
        section.name,
        section.status,
        formatPreparationMode(section.preparation_mode),
        section.recommended_action || "",
        section.incoming_count,
        section.current_count,
        "blocker",
        issue.code,
        issue.message,
      ]);
    }

    for (const issue of section.warnings || []) {
      rows.push([
        section.name,
        section.status,
        formatPreparationMode(section.preparation_mode),
        section.recommended_action || "",
        section.incoming_count,
        section.current_count,
        "warning",
        issue.code,
        issue.message,
      ]);
    }
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function buildRestoreIssuesCsv(report) {
  const rows = [["section", "preparation_mode", "severity", "issue_type", "code", "message"]];

  for (const section of report.sections || []) {
    for (const issue of section.blockers || []) {
      rows.push([section.name, formatPreparationMode(section.preparation_mode), issue.severity || "error", "blocker", issue.code, issue.message]);
    }
    for (const issue of section.warnings || []) {
      rows.push([section.name, formatPreparationMode(section.preparation_mode), issue.severity || "warn", "warning", issue.code, issue.message]);
    }
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function buildRestoreReportDigest(report) {
  if (!report) {
    return "";
  }

  const attentionSections = (report.sections || []).filter(
    (section) => section.status === "warn" || section.status === "error",
  );
  const topNames = attentionSections.slice(0, 3).map((section) => section.name).join(", ");

  return [
    `Bundle ${report.manifest.bundle_name}`,
    `${report.summary.blocked_sections} blocked`,
    `${report.summary.review_required_sections} review`,
    `${report.summary.ok_sections} safe`,
    topNames ? `priority: ${topNames}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function buildRestorePreparationMarkdown(report) {
  if (!report) {
    return "";
  }

  const lines = [
    "# Restore Import Preparation",
    "",
    `Bundle: ${report.manifest.bundle_name}`,
    `Generated: ${report.manifest.generated_at}`,
    `Readiness: ${report.summary.readiness_status}`,
    "",
    "## Plain-Language Summary",
    "",
    report.summary.plain_language_summary || "No plain-language summary available.",
    "",
    "## Recommended Next Step",
    "",
    report.summary.next_step || "No next step available.",
    "",
    "## Preparation Mix",
    "",
    report.summary.preparation_summary || "No preparation summary available.",
    "",
    "## Highest-Risk Sections",
    "",
  ];

  if (!report.summary.highest_risk_sections?.length) {
    lines.push("- None");
  } else {
    report.summary.highest_risk_sections.forEach((sectionName) => {
      lines.push(`- ${sectionName}`);
    });
  }

  lines.push("", "## Section Status", "");

  for (const section of report.sections || []) {
    lines.push(`- ${section.name}: ${section.status} (${section.incoming_count} incoming / ${section.current_count} current)`);
    lines.push(`  preparation mode: ${formatPreparationMode(section.preparation_mode) || "n/a"}`);
    lines.push(`  recommended action: ${section.recommended_action || "No recommended action available."}`);
  }

  return lines.join("\n");
}

export function buildRestoreImportPlanMarkdown(plan) {
  if (!plan) {
    return "";
  }

  const lines = [
    "# Controlled Restore Import Plan",
    "",
    `Plan ID: ${plan.summary.plan_id}`,
    `Bundle: ${plan.manifest.bundle_name}`,
    `Generated: ${plan.generated_at}`,
    `Plan status: ${plan.summary.plan_status}`,
    `Apply allowed: ${plan.summary.apply_allowed ? "yes" : "no"}`,
    "",
    "## Scope Summary",
    "",
    plan.summary.plan_scope_summary || "No scope summary available.",
    "",
    "## Reviewer Guidance",
    "",
    plan.summary.reviewer_guidance || "No reviewer guidance available.",
    "",
    "## Typed Confirmation Phrase",
    "",
    plan.summary.typed_confirmation_phrase || "No confirmation phrase available.",
    "",
    "## Sections",
    "",
  ];

  for (const section of plan.sections || []) {
    lines.push(`- ${section.name}: ${section.plan_state} (${String(section.preparation_mode || "").replaceAll("_", " ")})`);
    lines.push(`  include in plan: ${section.include_in_plan ? "yes" : "no"}`);
    lines.push(`  rationale: ${section.rationale || "No rationale available."}`);
    lines.push(`  recommended action: ${section.recommended_action || "No recommended action available."}`);
  }

  return lines.join("\n");
}

export function buildRestoreFilteredSectionsCsv(sections = []) {
  const rows = [[
    "section",
    "status",
    "preparation_mode",
    "incoming_count",
    "current_count",
    "blocker_count",
    "warning_count",
    "recommended_action",
    "notes",
  ]];

  for (const section of sections) {
    rows.push([
      section.name || "",
      section.status || "",
      formatPreparationMode(section.preparation_mode),
      section.incoming_count || 0,
      section.current_count || 0,
      (section.blockers || []).length,
      (section.warnings || []).length,
      section.recommended_action || "",
      (section.notes || []).join(" | "),
    ]);
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function analyzeBackupBundleText(bundleText) {
  if (!bundleText.trim()) {
    return { status: "empty", message: "Load or paste a backup bundle to inspect it." };
  }

  try {
    const parsed = JSON.parse(bundleText);
    const manifest = parsed && typeof parsed === "object" ? parsed.manifest : null;
    const sections = manifest && typeof manifest.sections === "object" ? manifest.sections : null;

    if (!manifest || !sections) {
      return {
        status: "invalid",
        message: "Bundle JSON is valid, but the expected manifest or sections block is missing.",
      };
    }

    return {
      status: "ready",
      message: "Bundle JSON parsed successfully and looks ready for dry-run validation.",
      manifest,
      sectionCount: Object.keys(sections).length,
      recordCount: Object.values(sections).reduce((total, value) => total + Number(value || 0), 0),
    };
  } catch (error) {
    return {
      status: "invalid",
      message: error instanceof Error ? error.message : "Bundle JSON could not be parsed.",
    };
  }
}

export function buildSelectedUsersCsv(items) {
  const rows = [["username", "role", "plan", "must_change_password", "created_at"]];
  for (const item of items) {
    rows.push([
      item.username || "",
      item.role || "",
      item.plan || "",
      item.must_change_password ? "true" : "false",
      item.created_at || "",
    ]);
  }
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function buildSelectedRequestsCsv(items) {
  const rows = [["status", "name", "email", "current_plan", "target_username", "reviewed_at", "updated_at", "created_at"]];
  for (const item of items) {
    rows.push([
      item.status || "",
      item.name || "",
      item.email || "",
      item.current_plan || "",
      item.target_username || "",
      item.reviewed_at || "",
      item.updated_at || "",
      item.created_at || "",
    ]);
  }
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}
