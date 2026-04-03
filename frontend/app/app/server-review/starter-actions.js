export function buildStarterMutationPreview(selectedItem, actionNote) {
  if (!selectedItem) {
    return null;
  }

  return {
    server_id: selectedItem.id,
    server_name: selectedItem.label,
    review_focus: selectedItem.segment,
    operator_note: actionNote || "Connection or diagnostics follow-up",
    next_live_routes: [
      `/servers/${selectedItem.id}/diagnostics`,
      `/servers/${selectedItem.id}/test`,
    ],
  };
}

export function buildStarterSummaryMetrics(filteredItems) {
  const segmentCounts = filteredItems.reduce((acc, item) => {
    acc[item.segment] = (acc[item.segment] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(segmentCounts)
    .map(([segment, count]) => `${segment} · ${count}`)
    .join(" / ");
}
