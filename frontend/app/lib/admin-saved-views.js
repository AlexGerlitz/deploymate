export function normalizeSavedViewName(value) {
  return value.trim().replaceAll(/\s+/g, " ");
}

export function formatSavedViews(items, options = {}) {
  const { formatDate = (value) => value, summarizeFilters = () => "" } = options;

  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && item.filters)
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || 0).getTime();
      return rightTime - leftTime;
    })
    .map((item) => {
      const updatedAt = item.updatedAt || new Date().toISOString();
      return {
        id: item.id,
        name: item.name,
        filters: item.filters,
        updatedAt,
        source: item.source || "local",
        updatedAtLabel: formatDate(updatedAt),
        sourceLabel: item.source === "imported" ? "Imported" : "Local",
        summary: summarizeFilters(item.filters),
      };
    });
}

export function normalizeSavedViewsForStorage(items) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    filters: item.filters,
    updatedAt: item.updatedAt,
    source: item.source || "local",
  }));
}

export function parseImportedSavedViews(payload) {
  if (Array.isArray(payload)) {
    return { views: payload, meta: { source: "legacy-array" } };
  }
  if (payload && Array.isArray(payload.views)) {
    return {
      views: payload.views,
      meta: {
        source: "bundle",
        version: payload.version,
        scope: payload.scope,
        exportedAt: payload.exported_at,
      },
    };
  }
  return { views: [], meta: null };
}

export function dedupeSavedViewsByName(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeSavedViewName(item.name).toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function mergeSavedViews(existingItems, importedItems) {
  return dedupeSavedViewsByName([...importedItems, ...existingItems]).slice(0, 8);
}

export function sortSavedViews(items, mode) {
  const nextItems = [...items];
  if (mode === "oldest") {
    return nextItems.sort(
      (left, right) => new Date(left.updatedAt || 0).getTime() - new Date(right.updatedAt || 0).getTime(),
    );
  }
  if (mode === "name") {
    return nextItems.sort((left, right) => left.name.localeCompare(right.name));
  }
  return nextItems.sort(
    (left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime(),
  );
}

export function upsertSavedView(items, options) {
  const { matchedView, name, filters, source = "local" } = options;
  const normalizedName = normalizeSavedViewName(name).toLowerCase();

  return [
    {
      id: matchedView ? matchedView.id : `${Date.now()}`,
      name,
      filters,
      updatedAt: new Date().toISOString(),
      source,
    },
    ...items
      .filter((item) => normalizeSavedViewName(item.name).toLowerCase() !== normalizedName)
      .map((item) => ({
        id: item.id,
        name: item.name,
        filters: item.filters,
        updatedAt: item.updatedAt,
        source: item.source,
      })),
  ].slice(0, 8);
}

export function replaceSavedView(items, options) {
  const { viewId, name, filters, source = "local" } = options;

  return [
    {
      id: viewId,
      name,
      filters,
      updatedAt: new Date().toISOString(),
      source,
    },
    ...items
      .filter((item) => item.id !== viewId)
      .map((item) => ({
        id: item.id,
        name: item.name,
        filters: item.filters,
        updatedAt: item.updatedAt,
        source: item.source,
      })),
  ].slice(0, 8);
}

export function removeSavedView(items, viewId) {
  return items
    .filter((item) => item.id !== viewId)
    .map((item) => ({
      id: item.id,
      name: item.name,
      filters: item.filters,
      updatedAt: item.updatedAt,
      source: item.source,
    }));
}

export function removeImportedSavedViews(items) {
  return items.filter((item) => item.source !== "imported");
}

export function importSavedViewsBundle(options) {
  const {
    payload,
    scope,
    currentViews,
    formatViews,
    formatDate = (value) => value,
    emptyStateMessage,
    wrongScopeMessage,
  } = options;

  const imported = parseImportedSavedViews(payload);
  if (imported.meta?.version && imported.meta.version !== 1) {
    throw new Error("Unsupported saved views export version.");
  }
  if (imported.meta?.scope && imported.meta.scope !== scope) {
    throw new Error(wrongScopeMessage);
  }

  const importedViews = formatSavedViews(imported.views).map((item) => ({
    ...item,
    source: "imported",
  }));
  const normalized = normalizeSavedViewsForStorage(
    mergeSavedViews(formatViews(currentViews), importedViews),
  );

  if (normalized.length === 0) {
    throw new Error(emptyStateMessage);
  }

  const currentFormattedViews = formatViews(currentViews);
  const importedNameSet = new Set(
    importedViews.map((item) => normalizeSavedViewName(item.name).toLowerCase()),
  );
  const replacedCount = currentFormattedViews.filter((item) =>
    importedNameSet.has(normalizeSavedViewName(item.name).toLowerCase()),
  ).length;
  const mergedTotal = dedupeSavedViewsByName([...importedViews, ...currentFormattedViews]).length;
  const skippedCount = Math.max(0, mergedTotal - normalized.length);
  const metaText =
    imported.meta?.source === "bundle"
      ? `Imported bundle${imported.meta.version ? ` v${imported.meta.version}` : ""}${imported.meta.exportedAt ? ` · exported ${formatDate(imported.meta.exportedAt)}` : ""}.`
      : "Imported legacy saved views file.";

  return {
    normalized,
    metaText,
    replacedCount,
    skippedCount,
  };
}
