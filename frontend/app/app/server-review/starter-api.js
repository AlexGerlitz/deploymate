import { readJsonOrError } from "../../lib/admin-page-utils";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export async function fetchServerReviewStarterList() {
  const response = await fetch(`${apiBaseUrl}/servers`, {
    credentials: "include",
    cache: "no-store",
  });
  return readJsonOrError(response, "Failed to load servers.");
}

export async function runServerReviewStarterAction(itemId, payload) {
  const action = payload?.action === "primary" ? "diagnostics" : "test";
  const route =
    action === "diagnostics"
      ? `${apiBaseUrl}/servers/${itemId}/diagnostics`
      : `${apiBaseUrl}/servers/${itemId}/test`;
  const method = action === "diagnostics" ? "GET" : "POST";
  const response = await fetch(route, {
    method,
    credentials: "include",
    cache: "no-store",
  });
  return readJsonOrError(
    response,
    action === "diagnostics"
      ? "Failed to load server diagnostics."
      : "Failed to test server connection.",
  );
}

export async function fetchServerReviewSuggestedPorts(itemId) {
  const response = await fetch(`${apiBaseUrl}/servers/${itemId}/suggested-ports`, {
    credentials: "include",
    cache: "no-store",
  });
  return readJsonOrError(response, "Failed to load suggested ports.");
}

export async function createServerReviewServer(payload) {
  const response = await fetch(`${apiBaseUrl}/servers`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return readJsonOrError(response, "Failed to create server.");
}

export async function deleteServerReviewServer(serverId) {
  const response = await fetch(`${apiBaseUrl}/servers/${serverId}`, {
    method: "DELETE",
    credentials: "include",
  });
  return readJsonOrError(response, "Failed to delete server.");
}

export async function updateServerReviewServer(serverId, payload) {
  const response = await fetch(`${apiBaseUrl}/servers/${serverId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return readJsonOrError(response, "Failed to update server.");
}
