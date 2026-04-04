import { useEffect, useState } from "react";
import {
  importSavedViewsBundle,
  normalizeSavedViewName,
  normalizeSavedViewsForStorage,
  removeImportedSavedViews,
  removeSavedView,
  replaceSavedView,
  sortSavedViews,
  upsertSavedView,
} from "./admin-saved-views";
import { buildPageUrl, persistFormattedViews, triggerFileDownload } from "./admin-page-utils";
import { formatDate } from "./runtime-workspace-utils";

export function useDebouncedValue(value, options = {}) {
  const { delay = 250, disabled = false, initialValue = value } = options;
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [delay, disabled, value]);

  return debouncedValue;
}

export function useLoadStoredFormattedViews(options) {
  const {
    disabled = false,
    storageKey,
    formatViews,
    setViews,
    setMetaText,
    loadedMetaText = "Loaded from local browser storage.",
    fallbackMetaText = "Using local browser storage.",
  } = options;

  useEffect(() => {
    if (disabled) {
      return;
    }

    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) {
        return;
      }
      setViews(formatViews(JSON.parse(stored)));
      if (typeof setMetaText === "function") {
        setMetaText(loadedMetaText);
      }
    } catch {
      setViews([]);
      if (typeof setMetaText === "function") {
        setMetaText(fallbackMetaText);
      }
    }
  }, [
    disabled,
    fallbackMetaText,
    formatViews,
    loadedMetaText,
    setMetaText,
    setViews,
    storageKey,
  ]);
}

export function useAdminSavedViewsManager(options) {
  const {
    smokeMode = false,
    initialViews = [],
    formatViews,
    storageKey,
    currentFilters,
    hasFilters,
    applyViewFilters,
    pathname,
    copyText,
    setFeedback,
    setError,
    initialMetaText = "Using local browser storage.",
    exportFilename,
    exportScope,
    summaryNoun,
    emptyImportMessage,
    wrongScopeMessage,
    saveSuccessMessage,
    updateSuccessMessage,
    deleteSuccessMessage,
    exportSuccessMessage,
    clearSuccessMessage,
    clearImportedSuccessMessage,
    resetToolsSuccessMessage,
    importMergeMessage,
  } = options;

  const [savedViews, setSavedViews] = useState(initialViews);
  const [savedViewName, setSavedViewName] = useState("");
  const [savedViewsMetaText, setSavedViewsMetaText] = useState(initialMetaText);
  const [savedViewsSearch, setSavedViewsSearch] = useState("");
  const [savedViewsSourceFilter, setSavedViewsSourceFilter] = useState("all");
  const [savedViewsSort, setSavedViewsSort] = useState("newest");

  useLoadStoredFormattedViews({
    disabled: smokeMode,
    storageKey,
    formatViews,
    setViews: setSavedViews,
    setMetaText: setSavedViewsMetaText,
  });

  const currentViewSignature = JSON.stringify(currentFilters);
  const normalizedSavedViewName = normalizeSavedViewName(savedViewName);
  const matchedSavedViewByName = savedViews.find(
    (item) => normalizeSavedViewName(item.name).toLowerCase() === normalizedSavedViewName.toLowerCase(),
  );
  const activeSavedViewId =
    savedViews.find((item) => JSON.stringify(item.filters) === currentViewSignature)?.id || "";
  const activeSavedView = savedViews.find((item) => item.id === activeSavedViewId) || null;
  const hasSavedViewNameMatch = Boolean(matchedSavedViewByName);
  const hasSavedViewChanges =
    matchedSavedViewByName &&
    JSON.stringify(matchedSavedViewByName.filters) !== currentViewSignature;
  const activeSavedViewHasChanges =
    activeSavedView &&
    JSON.stringify(activeSavedView.filters) !== currentViewSignature;
  const canSaveCurrentView = normalizedSavedViewName !== "" && hasFilters;
  const reachedViewLimitWithoutReplace = savedViews.length >= 8 && !hasSavedViewNameMatch;
  const visibleSavedViews = sortSavedViews(
    savedViews.filter((item) => {
      if (
        savedViewsSourceFilter !== "all" &&
        (item.source || "local") !== savedViewsSourceFilter
      ) {
        return false;
      }
      const haystack = `${item.name} ${item.summary || ""}`.toLowerCase();
      return haystack.includes(savedViewsSearch.trim().toLowerCase());
    }),
    savedViewsSort,
  );
  const savedViewsToolsDirty =
    normalizedSavedViewName !== "" ||
    savedViewsSearch.trim() !== "" ||
    savedViewsSourceFilter !== "all" ||
    savedViewsSort !== "newest";
  const savedViewsSummaryText =
    savedViews.length === 0
      ? ""
      : `Showing ${visibleSavedViews.length} of ${savedViews.length} saved ${summaryNoun} view${savedViews.length === 1 ? "" : "s"}.`;

  function persistSavedViews(nextViews) {
    persistFormattedViews(nextViews, {
      formatViews,
      setViews: setSavedViews,
      storageKey,
      disableStorage: smokeMode,
    });
  }

  function handleSaveCurrentView() {
    if (!canSaveCurrentView) {
      return;
    }

    persistSavedViews(
      upsertSavedView(savedViews, {
        matchedView: matchedSavedViewByName,
        name: normalizedSavedViewName,
        filters: currentFilters,
      }),
    );
    setSavedViewsMetaText("Using local browser storage.");
    setSavedViewName("");
    setFeedback(saveSuccessMessage);
    setError("");
  }

  function handleApplySavedView(viewId) {
    const nextView = savedViews.find((item) => item.id === viewId);
    if (!nextView) {
      return;
    }
    applyViewFilters(nextView.filters);
    setSavedViewName(nextView.name);
    setSavedViewsMetaText(
      nextView.source === "imported" ? "Applied an imported saved view." : "Applied a local saved view.",
    );
    setFeedback(`Applied saved view ${nextView.name}.`);
    setError("");
  }

  function handleUpdateCurrentView() {
    if (!activeSavedViewId) {
      return;
    }

    persistSavedViews(
      replaceSavedView(savedViews, {
        viewId: activeSavedViewId,
        name: activeSavedView?.name || normalizedSavedViewName || "Saved view",
        filters: currentFilters,
      }),
    );
    setSavedViewsMetaText("Using local browser storage.");
    setSavedViewName(activeSavedView?.name || "");
    setFeedback(updateSuccessMessage);
    setError("");
  }

  function handleDeleteSavedView(viewId) {
    const deletedView = savedViews.find((item) => item.id === viewId);
    persistSavedViews(removeSavedView(savedViews, viewId));
    if (deletedView && deletedView.name === savedViewName) {
      setSavedViewName("");
    }
    setFeedback(deleteSuccessMessage);
    setError("");
  }

  function handleDownloadSavedViews() {
    if (savedViews.length === 0) {
      return;
    }

    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            exported_at: new Date().toISOString(),
            scope: exportScope,
            views: normalizeSavedViewsForStorage(savedViews),
          },
          null,
          2,
        ),
      ],
      { type: "application/json;charset=utf-8" },
    );
    triggerFileDownload(exportFilename, blob);
    setFeedback(exportSuccessMessage);
    setError("");
  }

  function handleImportSavedViews(event) {
    const [file] = Array.from(event.target.files || []);
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(typeof reader.result === "string" ? reader.result : "[]");
        const { normalized, metaText, replacedCount, skippedCount } = importSavedViewsBundle({
          payload: parsed,
          scope: exportScope,
          currentViews: savedViews,
          formatViews,
          formatDate,
          emptyStateMessage: emptyImportMessage,
          wrongScopeMessage,
        });
        persistSavedViews(normalized);
        setSavedViewsMetaText(metaText);
        setFeedback(importMergeMessage({ total: normalized.length, replacedCount, skippedCount }));
        setError("");
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : emptyImportMessage,
        );
      }
    };
    reader.onerror = () => {
      setError("Failed to read saved views file.");
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handleClearSavedViews() {
    persistSavedViews([]);
    setSavedViewName("");
    setSavedViewsMetaText("Using local browser storage.");
    setFeedback(clearSuccessMessage);
    setError("");
  }

  function handleClearImportedSavedViews() {
    persistSavedViews(removeImportedSavedViews(savedViews));
    setSavedViewsMetaText("Using local browser storage.");
    setFeedback(clearImportedSuccessMessage);
    setError("");
  }

  function handleResetSavedViewsTools() {
    setSavedViewName("");
    setSavedViewsSearch("");
    setSavedViewsSourceFilter("all");
    setSavedViewsSort("newest");
    setSavedViewsMetaText("Using local browser storage.");
    setFeedback(resetToolsSuccessMessage);
    setError("");
  }

  function handleUseCurrentSavedViewName() {
    if (!activeSavedView?.name) {
      return;
    }
    setSavedViewName(activeSavedView.name);
  }

  async function handleCopySavedViewLink(viewId) {
    const nextView = savedViews.find((item) => item.id === viewId);
    if (!nextView) {
      return;
    }
    await copyText(buildPageUrl(window.location.origin, pathname, nextView.filters));
    setFeedback(`Saved view link copied for ${nextView.name}.`);
    setError("");
  }

  return {
    savedViews,
    savedViewName,
    setSavedViewName,
    savedViewsMetaText,
    savedViewsSearch,
    setSavedViewsSearch,
    savedViewsSourceFilter,
    setSavedViewsSourceFilter,
    savedViewsSort,
    setSavedViewsSort,
    normalizedSavedViewName,
    matchedSavedViewByName,
    activeSavedViewId,
    activeSavedView,
    hasSavedViewNameMatch,
    hasSavedViewChanges,
    activeSavedViewHasChanges,
    canSaveCurrentView,
    reachedViewLimitWithoutReplace,
    visibleSavedViews,
    savedViewsToolsDirty,
    savedViewsSummaryText,
    handleSaveCurrentView,
    handleApplySavedView,
    handleUpdateCurrentView,
    handleDeleteSavedView,
    handleDownloadSavedViews,
    handleImportSavedViews,
    handleClearSavedViews,
    handleClearImportedSavedViews,
    handleResetSavedViewsTools,
    handleUseCurrentSavedViewName,
    handleCopySavedViewLink,
  };
}

export function useAdminAuditViewsManager(options) {
  const {
    smokeMode = false,
    initialViews = [],
    formatViews,
    storageKey,
    currentFilters,
    canSaveWhen,
    applyViewFilters,
    pathname,
    copyText,
    setFeedback,
    setError,
    resetViewFilters,
    copyParams,
    resetMessage = "Audit tools reset.",
    saveMessage = "Audit view saved.",
    deleteMessage = "Audit view removed.",
  } = options;

  const [auditViews, setAuditViews] = useState(initialViews);
  const [auditViewName, setAuditViewName] = useState("");

  useLoadStoredFormattedViews({
    disabled: smokeMode,
    storageKey,
    formatViews,
    setViews: setAuditViews,
  });

  const currentViewSignature = JSON.stringify(currentFilters);
  const normalizedAuditViewName = normalizeSavedViewName(auditViewName);
  const matchedAuditViewByName = auditViews.find(
    (item) => normalizeSavedViewName(item.name).toLowerCase() === normalizedAuditViewName.toLowerCase(),
  );
  const canSaveAuditView = normalizedAuditViewName !== "" && canSaveWhen;

  function persistAuditViews(nextViews) {
    persistFormattedViews(nextViews, {
      formatViews,
      setViews: setAuditViews,
      storageKey,
      disableStorage: smokeMode,
    });
  }

  function handleSaveAuditView() {
    if (!canSaveAuditView) {
      return;
    }
    persistAuditViews(
      upsertSavedView(auditViews, {
        matchedView: matchedAuditViewByName,
        name: normalizedAuditViewName,
        filters: currentFilters,
      }),
    );
    setAuditViewName("");
    setFeedback(saveMessage);
    setError("");
  }

  function handleApplyAuditView(viewId) {
    const nextView = auditViews.find((item) => item.id === viewId);
    if (!nextView) {
      return;
    }
    applyViewFilters(nextView.filters);
    setAuditViewName(nextView.name);
    setFeedback(`Applied audit view ${nextView.name}.`);
    setError("");
  }

  function handleDeleteAuditView(viewId) {
    persistAuditViews(removeSavedView(auditViews, viewId));
    setFeedback(deleteMessage);
    setError("");
  }

  async function handleCopyAuditViewLink() {
    await copyText(buildPageUrl(window.location.origin, pathname, copyParams));
    setFeedback("Audit view link copied.");
    setError("");
  }

  function handleResetAuditTools() {
    resetViewFilters();
    setFeedback(resetMessage);
    setError("");
  }

  return {
    auditViews,
    auditViewName,
    setAuditViewName,
    normalizedAuditViewName,
    matchedAuditViewByName,
    activeAuditViewId:
      auditViews.find((item) => JSON.stringify(item.filters) === currentViewSignature)?.id || "",
    hasAuditViewNameMatch: Boolean(matchedAuditViewByName),
    canSaveAuditView,
    handleSaveAuditView,
    handleApplyAuditView,
    handleDeleteAuditView,
    handleCopyAuditViewLink,
    handleResetAuditTools,
  };
}
