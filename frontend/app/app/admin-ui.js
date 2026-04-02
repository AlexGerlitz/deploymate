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
  onUpdateCurrent,
  saveDisabled,
  updateDisabled,
  saveTestId,
  updateTestId,
  saveLabel = "Save current view",
  updateLabel = "Update current view",
  statusText = "",
  metaText = "",
  inputHint = "",
  inputCountText = "",
  viewSummaryText = "",
  useCurrentNameLabel = "",
  onUseCurrentName,
  useCurrentNameDisabled,
  searchValue = "",
  onSearchChange,
  searchTestId,
  searchPlaceholder = "Search saved views",
  sourceFilter = "all",
  onSourceFilterChange,
  sourceFilterTestId,
  sortValue = "newest",
  onSortChange,
  sortTestId,
  views = [],
  onApply,
  onDelete,
  onCopy,
  actions = [],
  emptyText,
  listTestId,
  activeViewId = "",
}) {
  const importedCount = views.filter((view) => view.source === "imported").length;
  const localCount = views.length - importedCount;

  return (
    <div className="adminSavedViews">
      <div className="sectionHeader">
        <div>
          <h3>{title}</h3>
          <p className="formHint">Saved locally in this browser for faster admin workflows.</p>
          <p className="formHint">
          {views.length === 0 ? "No saved views yet." : `${views.length} saved view${views.length === 1 ? "" : "s"} · max 8.`}
          </p>
          {views.length > 0 ? (
            <p className="formHint">
              {localCount} local · {importedCount} imported · newest first
            </p>
          ) : null}
          {views.length >= 8 ? (
            <p className="formHint">View limit reached. Saving a matching name will replace the existing preset.</p>
          ) : null}
          {importedCount > 0 ? (
            <p className="formHint">Imported presets can be removed with `Clear imported` without touching local ones.</p>
          ) : null}
        </div>
      </div>
      <div className="adminSavedViewsComposer">
        <label className="field">
          <span>{inputLabel}</span>
          <input value={inputValue} onChange={onInputChange} placeholder="Morning triage" maxLength={40} />
        </label>
        {onUseCurrentName ? (
          <button
            type="button"
            className="secondaryButton"
            onClick={onUseCurrentName}
            disabled={useCurrentNameDisabled}
          >
            {useCurrentNameLabel || "Use current name"}
          </button>
        ) : null}
        {inputHint ? <p className="formHint">{inputHint}</p> : null}
        {inputCountText ? <p className="formHint">{inputCountText}</p> : null}
        {statusText ? <p className="formHint">{statusText}</p> : null}
        {viewSummaryText ? <p className="formHint">{viewSummaryText}</p> : null}
        {metaText ? <p className="formHint">{metaText}</p> : null}
        <button
          type="button"
          className="secondaryButton"
          data-testid={saveTestId}
          onClick={onSave}
          disabled={saveDisabled}
        >
          {saveLabel}
        </button>
        {onUpdateCurrent ? (
          <button
            type="button"
            className="secondaryButton"
            data-testid={updateTestId}
            onClick={onUpdateCurrent}
            disabled={updateDisabled}
          >
            {updateLabel}
          </button>
        ) : null}
      </div>
      <div className="adminSavedViewsComposer">
        <label className="field">
          <span>Find saved views</span>
          <input
            data-testid={searchTestId}
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />
        </label>
        <label className="field">
          <span>Source</span>
          <select data-testid={sourceFilterTestId} value={sourceFilter} onChange={onSourceFilterChange}>
            <option value="all">All</option>
            <option value="local">Local</option>
            <option value="imported">Imported</option>
          </select>
        </label>
        <label className="field">
          <span>Sort</span>
          <select data-testid={sortTestId} value={sortValue} onChange={onSortChange}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
          </select>
        </label>
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
                  {view.sourceLabel ? (
                    <span className="status unknown">{view.sourceLabel}</span>
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
