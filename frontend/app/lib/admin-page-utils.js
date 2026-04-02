export async function readJsonOrError(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : fallbackMessage;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export function triggerFileDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function escapeCsvCell(value) {
  const normalized =
    value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replaceAll("\"", "\"\"")}"`;
  }
  return normalized;
}

export function buildSearchParams(paramsObject = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(paramsObject)) {
    if (
      value === undefined ||
      value === null ||
      value === false ||
      value === "" ||
      value === "all" ||
      value === "newest"
    ) {
      continue;
    }

    params.set(key, value === true ? "true" : String(value));
  }

  return params;
}

export function buildPageUrl(origin, pathname, paramsObject = {}) {
  const params = buildSearchParams(paramsObject);
  return `${origin}${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
}

export function persistFormattedViews(nextViews, options) {
  const { formatViews, setViews, storageKey, disableStorage = false } = options;
  setViews(formatViews(nextViews));

  if (!disableStorage) {
    window.localStorage.setItem(storageKey, JSON.stringify(nextViews));
  }
}

export function buildFilterChips(items = []) {
  return items.filter(Boolean);
}

export function isActiveFilterValue(candidate) {
  return (
    candidate !== undefined &&
    candidate !== null &&
    candidate !== false &&
    candidate !== "" &&
    candidate !== "all"
  );
}

export function createTextFilterDefinition(options) {
  const {
    key,
    value,
    setValue,
    chipKey,
    chipLabel,
    testId,
  } = options;

  return {
    key,
    value,
    normalizedValue: value.trim(),
    chipKey,
    chipLabel,
    onRemove: () => setValue(""),
    testId,
  };
}

export function createChoiceFilterDefinition(options) {
  const {
    key,
    value,
    setValue,
    chipKey,
    chipLabel,
    testId,
    resetValue = "all",
    normalizedValue = value,
  } = options;

  return {
    key,
    value,
    normalizedValue,
    chipKey,
    chipLabel,
    onRemove: () => setValue(resetValue),
    testId,
  };
}

export function createBooleanFilterDefinition(options) {
  const {
    key,
    value,
    setValue,
    chipKey,
    chipLabel,
    testId,
    offValue = false,
    serializeValue = true,
  } = options;

  return {
    key,
    value,
    normalizedValue: Boolean(value),
    serializeValue,
    chipKey,
    chipLabel,
    onRemove: () => setValue(offValue),
    testId,
  };
}

export function buildFilterState(definitions = []) {
  const currentFilters = {};
  let hasActiveFilters = false;
  const serializedEntries = [];

  for (const definition of definitions) {
    const {
      key,
      value,
      normalizedValue = value,
      activeWhen = isActiveFilterValue,
      serializeWhen = activeWhen,
      serializeValue = normalizedValue,
      includeInCurrent = true,
    } = definition;

    if (includeInCurrent) {
      currentFilters[key] = normalizedValue;
    }

    if (activeWhen(normalizedValue)) {
      hasActiveFilters = true;
    }

    serializedEntries.push([
      key,
      serializeWhen(normalizedValue) ? serializeValue : undefined,
    ]);
  }

  return {
    currentFilters,
    hasActiveFilters,
    syncedSearchParams: buildSearchParams(Object.fromEntries(serializedEntries)).toString(),
  };
}

export function buildFilterChipsFromDefinitions(definitions = []) {
  return buildFilterChips(
    definitions.map((definition) => {
      const {
        chipKey,
        chipLabel,
        onRemove,
        testId,
        activeWhen = isActiveFilterValue,
        normalizedValue = definition.value,
      } = definition;

      if (!chipKey || !chipLabel || !onRemove || !activeWhen(normalizedValue)) {
        return null;
      }

      return {
        key: chipKey,
        label: chipLabel,
        onRemove,
        testId,
      };
    }),
  );
}

export function sortItemsByDateMode(items, options = {}) {
  const {
    valueKey,
    mode = "newest",
    emptyValue = 0,
  } = options;

  return [...items].sort((left, right) => {
    const leftTime = new Date(left?.[valueKey] || emptyValue).getTime();
    const rightTime = new Date(right?.[valueKey] || emptyValue).getTime();
    return mode === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });
}

export function buildAuditEventsCsv(items, options = {}) {
  const includeTargetType = options.includeTargetType === true;
  const rows = [
    includeTargetType
      ? ["action_type", "actor_username", "target_type", "target_label", "details", "created_at"]
      : ["action_type", "actor_username", "target_label", "details", "created_at"],
  ];

  for (const item of items) {
    rows.push(
      includeTargetType
        ? [
            item.action_type || "",
            item.actor_username || "",
            item.target_type || "",
            item.target_label || item.target_id || "",
            item.details || "",
            item.created_at || "",
          ]
        : [
            item.action_type || "",
            item.actor_username || "",
            item.target_label || item.target_id || "",
            item.details || "",
            item.created_at || "",
          ],
    );
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export async function copyTextToClipboard(value) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
