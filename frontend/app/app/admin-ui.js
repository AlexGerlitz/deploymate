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
  actions = [],
}) {
  return (
    <div className="adminFilterFooter">
      <div className="adminFilterCopy">
        <p className="formHint">{summary}</p>
        <p className="formHint">{hint}</p>
      </div>
      <div className="adminFilterActions">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className="secondaryButton"
            data-testid={action.testId}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          className="secondaryButton"
          data-testid={resetTestId}
          onClick={onReset}
          disabled={resetDisabled}
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}

export function AdminActiveFilters({ filters = [] }) {
  const activeFilters = filters.filter(Boolean);

  if (activeFilters.length === 0) {
    return (
      <div className="adminFilterChips">
        <span className="adminFilterChip muted" data-testid="admin-active-filters-empty">
          No active filters
        </span>
      </div>
    );
  }

  return (
    <div className="adminFilterChips" data-testid="admin-active-filters">
      {activeFilters.map((item) => (
        <button
          key={item.key}
          type="button"
          className="adminFilterChip"
          data-testid={item.testId}
          onClick={item.onRemove}
        >
          <span>{item.label}</span>
          <span aria-hidden="true">x</span>
        </button>
      ))}
    </div>
  );
}

export function AdminSavedViews({
  title,
  inputLabel,
  inputValue,
  onInputChange,
  onSave,
  saveDisabled,
  saveTestId,
  saveLabel = "Save current view",
  statusText = "",
  views = [],
  onApply,
  onDelete,
  onCopy,
  actions = [],
  emptyText,
  listTestId,
  activeViewId = "",
}) {
  return (
    <div className="adminSavedViews">
      <div className="sectionHeader">
        <div>
          <h3>{title}</h3>
          <p className="formHint">Saved locally in this browser for faster admin workflows.</p>
          <p className="formHint">
            {views.length === 0 ? "No saved views yet." : `${views.length} saved view${views.length === 1 ? "" : "s"}.`}
          </p>
        </div>
      </div>
      <div className="adminSavedViewsComposer">
        <label className="field">
          <span>{inputLabel}</span>
          <input value={inputValue} onChange={onInputChange} placeholder="Morning triage" />
        </label>
        {statusText ? <p className="formHint">{statusText}</p> : null}
        <button
          type="button"
          className="secondaryButton"
          data-testid={saveTestId}
          onClick={onSave}
          disabled={saveDisabled}
        >
          {saveLabel}
        </button>
      </div>
      {actions.length > 0 ? (
        <div className="adminSavedViewActions">
          {actions.map((action) =>
            action.kind === "file" ? (
              <label key={action.label} className="secondaryButton adminActionLabel" data-testid={action.testId}>
                {action.label}
                <input type="file" accept={action.accept} onChange={action.onChange} />
              </label>
            ) : (
              <button
                key={action.label}
                type="button"
                className="secondaryButton"
                data-testid={action.testId}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </button>
            ),
          )}
        </div>
      ) : null}
      {views.length === 0 ? (
        <div className="empty" data-testid={listTestId}>
          {emptyText}
        </div>
      ) : (
        <div className="adminSavedViewsList" data-testid={listTestId}>
          {views.map((view) => (
            <div key={view.id} className="adminSavedViewCard">
              <div>
                <div className="adminSavedViewTitle">
                  <strong>{view.name}</strong>
                  {activeViewId === view.id ? (
                    <span className="status healthy">Current</span>
                  ) : null}
                </div>
                {view.summary ? <p className="formHint">{view.summary}</p> : null}
                <p className="formHint">Updated {view.updatedAtLabel}</p>
              </div>
              <div className="adminSavedViewActions">
                {onCopy ? (
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={() => onCopy(view.id)}
                  >
                    Copy link
                  </button>
                ) : null}
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => onApply(view.id)}
                  disabled={activeViewId === view.id}
                >
                  {activeViewId === view.id ? "Applied" : "Apply"}
                </button>
                <button type="button" className="secondaryButton" onClick={() => onDelete(view.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
