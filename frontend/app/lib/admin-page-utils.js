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
