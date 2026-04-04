"use client";

import Link from "next/link";

export function AdminPageHeader({
  title,
  titleTestId,
  subtitle,
  loading,
  onRefresh,
  refreshTestId,
  backHref = "/app",
  backLabel = "Back",
  primaryAction = null,
  actions = [],
}) {
  return (
    <section className="workspaceHero adminPageHero">
      <div className="workspaceHeroBackdrop" />
      <div className="header workspaceHeroHeader">
        <div>
          <div className="eyebrow">Admin workspace</div>
          <h1 data-testid={titleTestId}>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="buttonRow workspaceHeroActions">
          <Link href={backHref} className="linkButton workspaceSecondaryAction">
            {backLabel}
          </Link>
          {primaryAction ? (
            <button
              type="button"
              className="landingButton primaryButton workspacePrimaryAction"
              data-testid={primaryAction.testId}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </button>
          ) : null}
          {onRefresh ? (
            <button
              type="button"
              className="secondaryButton"
              data-testid={refreshTestId}
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          ) : null}
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="workspaceGhostAction"
              data-testid={action.testId}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
      <div className="workspaceHeroSummary">
        <div className="workspaceHeroMetric">
          <span>Control</span>
          <strong>Admin</strong>
          <p>Manage shared access, exports, and operational changes from one controlled surface.</p>
        </div>
        <div className="workspaceHeroMetric">
          <span>Review</span>
          <strong>Audit</strong>
          <p>Searchable audit history keeps reviews, handoff, and decision trails easy to follow.</p>
        </div>
        <div className="workspaceHeroMetric">
          <span>Speed</span>
          <strong>Saved views</strong>
          <p>Keep local presets for repeat review patterns, shared handoffs, and daily check-ins.</p>
        </div>
        <div className="workspaceHeroBadge workspaceHeroSpotlight">
          <span>What matters now</span>
          <strong>{title}</strong>
          <p>
            {primaryAction
              ? `Main next step: ${primaryAction.label}. Secondary tools stay available, but the primary path should be obvious first.`
              : "Use this surface to review signals quickly, make deliberate changes, and share the same view with others."}
          </p>
        </div>
      </div>
    </section>
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
          Clear filters
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
          <p className="formHint">Saved in this browser so recurring reviews and handoffs are one click away.</p>
          <p className="formHint">
          {views.length === 0 ? "No saved views yet." : `${views.length} saved view${views.length === 1 ? "" : "s"} ready here · max 8.`}
          </p>
          {views.length > 0 ? (
            <p className="formHint">
              {localCount} local · {importedCount} imported · newest first
            </p>
          ) : null}
          {views.length >= 8 ? (
            <p className="formHint">View limit reached. Reusing a matching name will replace the existing preset.</p>
          ) : null}
          {importedCount > 0 ? (
            <p className="formHint">Imported presets can be removed with `Clear imported` without touching your local ones.</p>
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
                    <span className="status healthy">Live view</span>
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
                    Share link
                  </button>
                ) : null}
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => onApply(view.id)}
                  disabled={activeViewId === view.id}
                >
                  {activeViewId === view.id ? "Applied" : "Use view"}
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

export function AdminDisclosureSection({
  title,
  subtitle = "",
  badge = "",
  defaultOpen = false,
  sectionId,
  testId,
  children,
}) {
  return (
    <details id={sectionId} className="adminDisclosure" open={defaultOpen} data-testid={testId}>
      <summary className="adminDisclosureSummary">
        <div className="adminDisclosureCopy">
          <strong>{title}</strong>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="adminDisclosureMeta">
          {badge ? <span className="status unknown">{badge}</span> : null}
          <span className="adminDisclosureChevron" aria-hidden="true">
            ▾
          </span>
        </div>
      </summary>
      <div className="adminDisclosureBody">{children}</div>
    </details>
  );
}

export function AdminSurfaceSummary({
  title,
  description,
  metrics = [],
  spotlightTitle = "What this surface should do",
  spotlightBody,
}) {
  return (
    <article className="card formCard">
      <div className="sectionHeader">
        <div>
          <h2>{title}</h2>
          <p className="formHint">{description}</p>
        </div>
      </div>
      <div className="workspaceHeroSummary">
        {metrics.map((metric) => (
          <div key={metric.label} className="workspaceHeroMetric">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.description}</p>
          </div>
        ))}
        <div className="workspaceHeroBadge workspaceHeroSpotlight">
          <span>Scaffold focus</span>
          <strong>{spotlightTitle}</strong>
          <p>{spotlightBody}</p>
        </div>
      </div>
    </article>
  );
}

export function AdminSurfaceQueue({
  title,
  description,
  searchLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchTestId,
  emptyTestId,
  emptyText,
  items = [],
  children,
}) {
  return (
    <article className="card formCard">
      <div className="sectionHeader">
        <div>
          <h2>{title}</h2>
          <p className="formHint">{description}</p>
        </div>
      </div>
      <label className="field deploymentSearch">
        <span>{searchLabel}</span>
        <input
          data-testid={searchTestId}
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
      </label>
      {items.length === 0 ? (
        <div className="empty" data-testid={emptyTestId}>
          {emptyText}
        </div>
      ) : (
        <div className="adminSavedViewsList">{children}</div>
      )}
    </article>
  );
}

export function AdminSurfaceQueueCard({ title, body, status, children }) {
  return (
    <article className="card formCard">
      <div className="sectionHeader">
        <div>
          <h3>{title}</h3>
          <p className="formHint">{body}</p>
        </div>
        {status ? <span className="status unknown">{status}</span> : null}
      </div>
      {children}
    </article>
  );
}

export function AdminSurfaceTable({
  title,
  description,
  columns = [],
  rows = [],
  rowKey = (row) => row.id,
  selectedRowId = "",
  emptyText,
  emptyTestId,
  tableTestId,
  renderCell,
  renderActions,
}) {
  return (
    <article className="card formCard">
      <div className="sectionHeader">
        <div>
          <h2>{title}</h2>
          <p className="formHint">{description}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty" data-testid={emptyTestId}>
          {emptyText}
        </div>
      ) : (
        <div className="adminSurfaceTableWrap">
          <table className="adminSurfaceTable" data-testid={tableTestId}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
                {renderActions ? <th scope="col">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row);
                const isSelected = key === selectedRowId;
                return (
                  <tr key={key} className={isSelected ? "isSelected" : ""}>
                    {columns.map((column) => (
                      <td key={column.key} data-label={column.label}>
                        {renderCell ? renderCell(row, column) : row[column.key]}
                      </td>
                    ))}
                    {renderActions ? (
                      <td data-label="Actions">
                        <div className="adminSurfaceTableActions">{renderActions(row)}</div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function AdminSurfaceActionStarter({
  title,
  description,
  badge = "Action starter",
  testId,
  status,
  item,
  noteValue,
  onNoteChange,
  notePlaceholder,
  primaryActionLabel,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  actionDisabled,
  emptyText = "No queue item selected yet.",
}) {
  return (
    <AdminDisclosureSection
      title={title}
      subtitle={description}
      badge={badge}
      defaultOpen
      testId={testId}
    >
      <div className="sectionHeader">
        <div>
          <h3>Focused queue item</h3>
        </div>
        {status ? <span className="status unknown">{status}</span> : null}
      </div>
      {item ? (
        <>
          <p className="formHint">
            <strong>{item.label}</strong> · {item.note}
          </p>
          <label className="field">
            <span>Operator note</span>
            <textarea
              rows={3}
              value={noteValue}
              onChange={onNoteChange}
              placeholder={notePlaceholder}
            />
          </label>
          <div className="adminFilterActions">
            <button
              type="button"
              className="secondaryButton"
              onClick={onPrimaryAction}
              disabled={actionDisabled}
            >
              {primaryActionLabel}
            </button>
            <button
              type="button"
              className="secondaryButton"
              onClick={onSecondaryAction}
              disabled={actionDisabled}
            >
              {secondaryActionLabel}
            </button>
          </div>
        </>
      ) : (
        <div className="empty">{emptyText}</div>
      )}
    </AdminDisclosureSection>
  );
}

export function AdminSurfaceBulkStarter({
  title,
  description,
  badge = "Bulk starter",
  testId,
  presetOneLabel,
  onPresetOne,
  presetTwoLabel,
  onPresetTwo,
  selectedCount,
  visibleCount,
  statusValue,
  onStatusChange,
  statusOptions = [],
  applyLabel,
  onApply,
  applyDisabled,
}) {
  return (
    <AdminDisclosureSection
      title={title}
      subtitle={description}
      badge={badge}
      testId={testId}
    >
      <div className="adminFilterActions">
        <button type="button" className="secondaryButton" onClick={onPresetOne}>
          {presetOneLabel}
        </button>
        <button type="button" className="secondaryButton" onClick={onPresetTwo}>
          {presetTwoLabel}
        </button>
      </div>
      <p className="formHint">
        Selected {selectedCount} · Visible {visibleCount}
      </p>
      <label className="field">
        <span>Bulk status</span>
        <select value={statusValue} onChange={onStatusChange}>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="secondaryButton"
        onClick={onApply}
        disabled={applyDisabled}
      >
        {applyLabel}
      </button>
    </AdminDisclosureSection>
  );
}

export function AdminSurfaceMutationPreview({
  title = "Starter mutation contract",
  description,
  badge = "Mutation",
  testId,
  routeLabel,
  selectedSummary,
  payload,
}) {
  return (
    <AdminDisclosureSection
      title={title}
      subtitle={description}
      badge={badge}
      testId={testId}
    >
      <p className="formHint">
        <strong>Route:</strong> {routeLabel}
      </p>
      <p className="formHint">
        <strong>Selected:</strong> {selectedSummary}
      </p>
      <pre className="workspaceCodeBlock">{JSON.stringify(payload, null, 2)}</pre>
    </AdminDisclosureSection>
  );
}

export function AdminAuditToolbar({
  title,
  description,
  query,
  onQueryChange,
  queryPlaceholder,
  queryTestId,
  filterLabel,
  filterValue,
  onFilterChange,
  filterOptions = [],
  filterTestId,
  sortValue = "newest",
  onSortChange,
  sortTestId,
  totalCount,
  summary,
  filters = [],
  actions = [],
  emptyTestId,
  emptyText,
  children,
}) {
  return (
    <article className="card formCard">
      <div className="sectionHeader">
        <div>
          <h2>{title}</h2>
          <p className="formHint">{description}</p>
        </div>
      </div>
      <label className="field deploymentSearch">
        <span>Search activity</span>
        <input data-testid={queryTestId} value={query} onChange={onQueryChange} placeholder={queryPlaceholder} />
      </label>
      {filterOptions.length > 0 || onSortChange ? (
        <div className="adminSavedViewsComposer">
          {filterOptions.length > 0 ? (
            <label className="field">
              <span>{filterLabel}</span>
              <select data-testid={filterTestId} value={filterValue} onChange={onFilterChange}>
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {onSortChange ? (
            <label className="field">
              <span>Sort</span>
              <select data-testid={sortTestId} value={sortValue} onChange={onSortChange}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      <p className="formHint">Recent activity items shown: {totalCount}</p>
      <p className="formHint">{summary}</p>
      <AdminActiveFilters filters={filters} />
      {actions.length > 0 ? (
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
        </div>
      ) : null}
      {totalCount === 0 ? (
        <div className="empty" data-testid={emptyTestId}>
          {emptyText}
        </div>
      ) : (
        children
      )}
    </article>
  );
}
