"use client";

import Link from "next/link";

export function AdminPageHeader({
  title,
  titleTestId,
  subtitle,
  loading,
  onRefresh,
  refreshTestId,
  actions = [],
}) {
  return (
    <div className="header">
      <div>
        <h1 data-testid={titleTestId}>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="buttonRow">
        <Link href="/app" className="linkButton">
          Back
        </Link>
        <button type="button" data-testid={refreshTestId} onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            data-testid={action.testId}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminFeedbackBanners({
  smokeMode,
  error,
  success,
  errorTestId,
  successTestId,
}) {
  return (
    <>
      {smokeMode ? (
        <div className="banner subtle" data-testid="admin-smoke-banner">
          Smoke mode active
        </div>
      ) : null}
      {error ? (
        <div className="banner error" data-testid={errorTestId}>
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="banner success" data-testid={successTestId}>
          {success}
        </div>
      ) : null}
    </>
  );
}

export function AdminFilterFooter({
  summary,
  hint,
  onReset,
  resetDisabled,
  resetTestId,
}) {
  return (
    <div className="adminFilterFooter">
      <div className="adminFilterCopy">
        <p className="formHint">{summary}</p>
        <p className="formHint">{hint}</p>
      </div>
      <button type="button" className="secondaryButton" data-testid={resetTestId} onClick={onReset} disabled={resetDisabled}>
        Reset filters
      </button>
    </div>
  );
}
