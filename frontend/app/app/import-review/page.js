"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AdminFeedbackBanners, AdminPageHeader } from "../admin-ui";
import {
  copyTextToClipboard,
  loadSessionJson,
  readJsonOrError,
  removeSessionValue,
  triggerFileDownload,
} from "../../lib/admin-page-utils";
import {
  buildImportReviewApprovalPacket,
  buildImportReviewApprovalTrail,
  buildImportReviewCsv,
  buildImportReviewMarkdown,
  importReviewHandoffStorageKey,
} from "../../lib/import-review-feature-pack";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatPreparationMode(mode) {
  return String(mode || "")
    .split("_")
    .filter(Boolean)
    .join(" ");
}

function readImportReviewHandoff() {
  const payload = loadSessionJson(importReviewHandoffStorageKey);

  if (!payload || !payload.workspace || !payload.workspace.import_plan || !payload.workspace.dry_run) {
    return null;
  }

  return payload;
}

function ImportReviewPageContent() {
  const [workspace, setWorkspace] = useState(null);
  const [workspaceSource, setWorkspaceSource] = useState("loading");
  const [handoffAvailable, setHandoffAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [planStateFilter, setPlanStateFilter] = useState("all");
  const [typedReviewValue, setTypedReviewValue] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadWorkspace(options = {}) {
    const { forceLive = false } = options;
    setLoading(true);
    setError("");
    try {
      if (!forceLive) {
        const handoff = readImportReviewHandoff();
        if (handoff) {
          setWorkspace(handoff.workspace);
          setWorkspaceSource("restore_handoff");
          setHandoffAvailable(true);
          setTypedReviewValue("");
          setSuccess("Import review workspace loaded from the restore handoff.");
          return;
        }
      }

      const response = await fetch(`${apiBaseUrl}/import-review`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await readJsonOrError(response, "Failed to load import review workspace.");
      setWorkspace(data);
      setWorkspaceSource("live_backup");
      setHandoffAvailable(Boolean(readImportReviewHandoff()));
      setTypedReviewValue("");
      setSuccess(forceLive ? "Import review workspace refreshed from the current live backup." : "Import review workspace refreshed.");
    } catch (requestError) {
      setWorkspace(null);
      setWorkspaceSource("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load import review workspace.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, []);

  async function handleUseLiveBackupWorkspace() {
    removeSessionValue(importReviewHandoffStorageKey);
    setHandoffAvailable(false);
    await loadWorkspace({ forceLive: true });
  }

  const visibleSections = useMemo(() => {
    if (!workspace) {
      return [];
    }

    return workspace.import_plan.sections.filter((section) => {
      if (planStateFilter !== "all" && section.plan_state !== planStateFilter) {
        return false;
      }

      const normalized = query.trim().toLowerCase();
      if (!normalized) {
        return true;
      }

      const haystack = [
        section.name,
        section.plan_state,
        section.preparation_mode,
        section.rationale,
        section.recommended_action,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [planStateFilter, query, workspace]);

  function handleDownloadPlanJson() {
    if (!workspace) {
      return;
    }
    const blob = new Blob([JSON.stringify(workspace.import_plan, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    triggerFileDownload("deploymate-import-review-plan.json", blob);
    setSuccess("Import review plan JSON downloaded.");
  }

  function handleDownloadPlanMarkdown() {
    if (!workspace) {
      return;
    }
    const blob = new Blob([buildImportReviewMarkdown(workspace)], {
      type: "text/markdown;charset=utf-8",
    });
    triggerFileDownload("deploymate-import-review-plan.md", blob);
    setSuccess("Import review plan markdown downloaded.");
  }

  function handleDownloadPlanCsv() {
    if (!workspace) {
      return;
    }
    const blob = new Blob([buildImportReviewCsv(visibleSections)], {
      type: "text/csv;charset=utf-8",
    });
    triggerFileDownload("deploymate-import-review-plan-sections.csv", blob);
    setSuccess("Import review plan CSV downloaded.");
  }

  function handleDownloadApprovalPacket() {
    if (!workspace) {
      return;
    }
    const blob = new Blob([buildImportReviewApprovalPacket(workspace)], {
      type: "text/markdown;charset=utf-8",
    });
    triggerFileDownload("deploymate-import-review-approval-packet.md", blob);
    setSuccess("Approval packet markdown downloaded.");
  }

  function handleDownloadApprovalTrailJson() {
    if (!workspace) {
      return;
    }
    const trail = buildImportReviewApprovalTrail(workspace);
    const blob = new Blob([JSON.stringify(trail, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    triggerFileDownload("deploymate-import-review-approval-trail.json", blob);
    setSuccess("Approval trail JSON downloaded.");
  }

  async function handleCopyApprovalQuestion() {
    if (!workspace) {
      return;
    }
    await copyTextToClipboard(workspace.import_plan.summary.approval_decision_question);
    setSuccess("Approval decision question copied.");
  }

  async function handleCopyApprovalSummary() {
    if (!workspace) {
      return;
    }
    await copyTextToClipboard(
      [
        workspace.import_plan.summary.approval_packet_title,
        workspace.import_plan.summary.approval_subject_line,
        workspace.import_plan.summary.approval_share_summary,
        workspace.import_plan.summary.approval_decision_question,
        `Next step: ${workspace.import_plan.summary.approval_next_step}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    setSuccess("Approval handoff summary copied.");
  }

  async function handleCopyConfirmation() {
    if (!workspace) {
      return;
    }
    await copyTextToClipboard(workspace.import_plan.summary.typed_confirmation_phrase);
    setSuccess("Typed confirmation phrase copied.");
  }

  function handleConfirmReviewAcknowledgement() {
    if (!workspace) {
      return;
    }
    if (typedReviewValue.trim() !== workspace.import_plan.summary.typed_review_phrase) {
      setError("Type the exact review phrase before confirming acknowledgement.");
      setSuccess("");
      return;
    }
    setSuccess("Import review acknowledgement captured locally. Live apply remains blocked.");
    setError("");
  }

  return (
    <main className="workspaceShell">
      <AdminPageHeader
        title="Import Review"
        titleTestId="import-review-page-title"
        subtitle="Review the current backup bundle, dry-run result, and controlled import scope before any future apply boundary."
        loading={loading}
        onRefresh={loadWorkspace}
        refreshTestId="import-review-refresh-button"
        actions={[
          {
            label: "Plan JSON",
            testId: "import-review-plan-json-button",
            onClick: handleDownloadPlanJson,
            disabled: !workspace,
          },
          {
            label: "Plan markdown",
            testId: "import-review-plan-markdown-button",
            onClick: handleDownloadPlanMarkdown,
            disabled: !workspace,
          },
          {
            label: "Copy confirmation",
            testId: "import-review-copy-confirmation-button",
            onClick: handleCopyConfirmation,
            disabled: !workspace,
          },
          {
            label: "Approval packet",
            testId: "import-review-approval-packet-button",
            onClick: handleDownloadApprovalPacket,
            disabled: !workspace,
          },
          {
            label: "Approval trail JSON",
            testId: "import-review-approval-trail-button",
            onClick: handleDownloadApprovalTrailJson,
            disabled: !workspace,
          },
        ]}
      />

      <AdminFeedbackBanners
        smokeMode={false}
        error={error}
        success={success}
        errorTestId="import-review-error"
        successTestId="import-review-success"
      />

      {workspace ? (
        <>
          <div className="overviewGrid" data-testid="import-review-overview">
            <div className="overviewCard" data-testid="import-review-bundle-card">
              <span className="overviewLabel">Bundle</span>
              <strong className="overviewValue">{workspace.bundle_manifest.bundle_name}</strong>
              <div className="overviewMeta">
                <span>Version {workspace.bundle_manifest.version}</span>
                <span>Generated {formatDate(workspace.bundle_manifest.generated_at)}</span>
              </div>
            </div>
            <div className="overviewCard" data-testid="import-review-readiness-card">
              <span className="overviewLabel">Dry-run readiness</span>
              <strong className="overviewValue">{workspace.dry_run.summary.readiness_status}</strong>
              <div className="overviewMeta">
                <span>Blocked {workspace.dry_run.summary.blocked_sections}</span>
                <span>Review {workspace.dry_run.summary.review_required_sections}</span>
                <span>Safe {workspace.dry_run.summary.ok_sections}</span>
              </div>
            </div>
            <div className="overviewCard" data-testid="import-review-plan-status-card">
              <span className="overviewLabel">Plan status</span>
              <strong className="overviewValue">{workspace.import_plan.summary.plan_status}</strong>
              <div className="overviewMeta">
                <span>Apply allowed {workspace.import_plan.summary.apply_allowed ? "yes" : "no"}</span>
                <span>Included {workspace.import_plan.summary.included_sections.length}</span>
              </div>
            </div>
          </div>

          <article className="card compactCard" data-testid="import-review-source-card">
            <div className="sectionHeader">
              <div>
                <h3 data-testid="import-review-source-title">Workspace source</h3>
                <p className="formHint">
                  Keep review tied to the exact bundle you just validated, or switch back to the current live backup when you need a fresh baseline.
                </p>
              </div>
            </div>
            <div className="row">
              <span className="label">Current source</span>
              <span data-testid="import-review-source-badge">
                {workspaceSource === "restore_handoff" ? "restore handoff" : "live backup"}
              </span>
            </div>
            <div className="row">
              <span className="label">Handoff available</span>
              <span data-testid="import-review-handoff-available">{handoffAvailable ? "yes" : "no"}</span>
            </div>
            <div className="row">
              <span className="label">Bundle name</span>
              <span data-testid="import-review-source-bundle">{workspace.bundle_manifest.bundle_name}</span>
            </div>
            <div className="actionCluster">
              <button
                type="button"
                className="softButton"
                data-testid="import-review-use-live-button"
                onClick={handleUseLiveBackupWorkspace}
              >
                Use current live backup
              </button>
              <Link href="/app/users" className="secondaryButton" data-testid="import-review-restore-link">
                Back to restore workspace
              </Link>
            </div>
          </article>

          <div className="banner error" data-testid="import-review-apply-boundary-banner">
            {workspace.import_plan.summary.apply_block_reason}
          </div>

          <article className="card compactCard" data-testid="import-review-guidance-card">
            <div className="sectionHeader">
              <div>
                <h3 data-testid="import-review-guidance-title">Controlled import boundary</h3>
                <p className="formHint">
                  This screen narrows future import scope. It does not authorize a live restore apply.
                </p>
              </div>
            </div>
            <div className="row">
              <span className="label">Boundary message</span>
              <span data-testid="import-review-boundary-message">{workspace.import_plan.summary.boundary_message}</span>
            </div>
            <div className="row">
              <span className="label">Scope summary</span>
              <span data-testid="import-review-scope-summary">{workspace.import_plan.summary.plan_scope_summary}</span>
            </div>
            <div className="row">
              <span className="label">Reviewer guidance</span>
              <span data-testid="import-review-reviewer-guidance">{workspace.import_plan.summary.reviewer_guidance}</span>
            </div>
            <div className="row">
              <span className="label">Typed confirmation</span>
              <span data-testid="import-review-confirmation">{workspace.import_plan.summary.typed_confirmation_phrase}</span>
            </div>
            <div className="row">
              <span className="label">Next step</span>
              <span data-testid="import-review-next-step">{workspace.dry_run.summary.next_step}</span>
            </div>
            <div className="actionCluster">
              <button
                type="button"
                className="softButton"
                data-testid="import-review-plan-csv-button"
                onClick={handleDownloadPlanCsv}
              >
                Visible sections CSV
              </button>
              <Link href="/app/users" className="secondaryButton" data-testid="import-review-users-link">
                Open full restore workspace
              </Link>
            </div>
          </article>

          <article className="card compactCard" data-testid="import-review-acknowledgement-card">
            <div className="sectionHeader">
              <div>
                <h3 data-testid="import-review-acknowledgement-title">Apply-readiness review</h3>
                <p className="formHint">
                  Use this acknowledgement step to confirm operator understanding before any future controlled apply flow exists.
                </p>
              </div>
            </div>
            <div className="row">
              <span className="label">Readiness status</span>
              <span data-testid="import-review-readiness-status">{workspace.import_plan.summary.apply_readiness_status}</span>
            </div>
            <div className="row">
              <span className="label">Readiness summary</span>
              <span data-testid="import-review-readiness-summary">{workspace.import_plan.summary.apply_readiness_summary}</span>
            </div>
            <div className="backupIssueList" data-testid="import-review-acknowledgement-items">
              {(workspace.import_plan.summary.acknowledgement_items || []).map((item, index) => (
                <div className="row" key={`ack-item-${index}`}>
                  <span className="label">Check</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <label className="field">
              <span>Type review phrase</span>
              <input
                data-testid="import-review-typed-review-input"
                value={typedReviewValue}
                onChange={(event) => setTypedReviewValue(event.target.value)}
                placeholder={workspace.import_plan.summary.typed_review_phrase}
              />
            </label>
            <p className="formHint" data-testid="import-review-typed-review-phrase">
              Exact phrase: {workspace.import_plan.summary.typed_review_phrase}
            </p>
            <div className="actionCluster">
              <button
                type="button"
                className="secondaryButton"
                data-testid="import-review-acknowledge-button"
                onClick={handleConfirmReviewAcknowledgement}
              >
                Confirm review acknowledgement
              </button>
              <button
                type="button"
                className="softButton"
                data-testid="import-review-copy-typed-review-button"
                onClick={() => copyTextToClipboard(workspace.import_plan.summary.typed_review_phrase).then(() => setSuccess("Typed review phrase copied."))}
              >
                Copy review phrase
              </button>
            </div>
          </article>

          <article className="card compactCard" data-testid="import-review-approval-card">
            <div className="sectionHeader">
              <div>
                <h3 data-testid="import-review-approval-title">Approval handoff</h3>
                <p className="formHint">
                  Use this packet when the next decision belongs to a reviewer or approver, not to the operator running local analysis.
                </p>
              </div>
            </div>
            <div className="row">
              <span className="label">Approval status</span>
              <span data-testid="import-review-approval-status">{workspace.import_plan.summary.approval_status}</span>
            </div>
            <div className="row">
              <span className="label">Packet title</span>
              <span data-testid="import-review-approval-packet-title">{workspace.import_plan.summary.approval_packet_title}</span>
            </div>
            <div className="row">
              <span className="label">Subject line</span>
              <span data-testid="import-review-approval-subject-line">{workspace.import_plan.summary.approval_subject_line}</span>
            </div>
            <div className="row">
              <span className="label">Share summary</span>
              <span data-testid="import-review-approval-share-summary">{workspace.import_plan.summary.approval_share_summary}</span>
            </div>
            <div className="row">
              <span className="label">Decision question</span>
              <span data-testid="import-review-approval-question">{workspace.import_plan.summary.approval_decision_question}</span>
            </div>
            <div className="row">
              <span className="label">Approval summary</span>
              <span data-testid="import-review-approval-summary">{workspace.import_plan.summary.approval_summary}</span>
            </div>
            <div className="backupIssueList" data-testid="import-review-approval-checklist">
              {(workspace.import_plan.summary.approval_checklist || []).map((item, index) => (
                <div className="row" key={`approval-item-${index}`}>
                  <span className="label">Check</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="row">
              <span className="label">Handoff note</span>
              <span data-testid="import-review-approval-handoff-note">{workspace.import_plan.summary.approval_handoff_note}</span>
            </div>
            <div className="row">
              <span className="label">Next step</span>
              <span data-testid="import-review-approval-next-step">{workspace.import_plan.summary.approval_next_step}</span>
            </div>
            <div className="actionCluster">
              <button
                type="button"
                className="secondaryButton"
                data-testid="import-review-approval-download-button"
                onClick={handleDownloadApprovalPacket}
              >
                Download approval packet
              </button>
              <button
                type="button"
                className="secondaryButton"
                data-testid="import-review-approval-trail-download-button"
                onClick={handleDownloadApprovalTrailJson}
              >
                Download approval trail JSON
              </button>
              <button
                type="button"
                className="softButton"
                data-testid="import-review-approval-copy-question-button"
                onClick={handleCopyApprovalQuestion}
              >
                Copy decision question
              </button>
              <button
                type="button"
                className="softButton"
                data-testid="import-review-approval-copy-summary-button"
                onClick={handleCopyApprovalSummary}
              >
                Copy handoff summary
              </button>
            </div>
          </article>

          <article className="card compactCard" data-testid="import-review-filters-card">
            <div className="adminSavedViewsComposer">
              <label className="field">
                <span>Plan state</span>
                <select
                  data-testid="import-review-state-filter"
                  value={planStateFilter}
                  onChange={(event) => setPlanStateFilter(event.target.value)}
                >
                  <option value="all">All states</option>
                  <option value="include">Include</option>
                  <option value="review">Review</option>
                  <option value="blocked">Blocked</option>
                  <option value="exclude">Exclude</option>
                </select>
              </label>
              <label className="field">
                <span>Search sections</span>
                <input
                  data-testid="import-review-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="users, blocked, dry-run"
                />
              </label>
            </div>
            <p className="formHint" data-testid="import-review-visible-summary">
              Showing {visibleSections.length} of {workspace.import_plan.sections.length} section{workspace.import_plan.sections.length === 1 ? "" : "s"}.
            </p>
          </article>

          <div className="overviewAttentionList" data-testid="import-review-sections">
            {visibleSections.map((section) => (
              <div
                className="overviewAttentionItem"
                key={section.name}
                data-testid={`import-review-section-${section.name}`}
              >
                <div className="row">
                  <span className="label">Section</span>
                  <span>{section.name}</span>
                </div>
                <div className="row">
                  <span className="label">Plan state</span>
                  <span>{section.plan_state}</span>
                </div>
                <div className="row">
                  <span className="label">Preparation mode</span>
                  <span>{formatPreparationMode(section.preparation_mode)}</span>
                </div>
                <div className="row">
                  <span className="label">Include in plan</span>
                  <span>{section.include_in_plan ? "yes" : "no"}</span>
                </div>
                <div className="row">
                  <span className="label">Rationale</span>
                  <span>{section.rationale}</span>
                </div>
                <div className="row">
                  <span className="label">Recommended action</span>
                  <span>{section.recommended_action}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}

export default function ImportReviewPage() {
  return (
    <Suspense fallback={<main className="workspaceShell"><div className="card formCard">Loading...</div></main>}>
      <ImportReviewPageContent />
    </Suspense>
  );
}
