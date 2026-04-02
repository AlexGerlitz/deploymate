import { escapeCsvCell } from "./admin-page-utils";

export function buildRestoreDryRunCsv(report) {
  const rows = [
    ["section", "status", "incoming_count", "current_count", "issue_type", "code", "message"],
  ];

  for (const section of report.sections || []) {
    if (!section.blockers.length && !section.warnings.length) {
      rows.push([
        section.name,
        section.status,
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
  const rows = [["section", "severity", "issue_type", "code", "message"]];

  for (const section of report.sections || []) {
    for (const issue of section.blockers || []) {
      rows.push([section.name, issue.severity || "error", "blocker", issue.code, issue.message]);
    }
    for (const issue of section.warnings || []) {
      rows.push([section.name, issue.severity || "warn", "warning", issue.code, issue.message]);
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
