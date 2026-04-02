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
