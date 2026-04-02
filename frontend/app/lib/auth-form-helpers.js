export const publicApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export function resolvePublicOrigin(request) {
  const forwardedProto =
    request.headers.get("x-forwarded-proto") || request.nextUrl.protocol.replace(":", "");
  const forwardedHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.host;
  return `${forwardedProto}://${forwardedHost}`;
}

export function resolveServerApiUrl(request, path) {
  if (publicApiBaseUrl.startsWith("http://") || publicApiBaseUrl.startsWith("https://")) {
    return `${publicApiBaseUrl}${path}`;
  }

  return new URL(`${publicApiBaseUrl}${path}`, resolvePublicOrigin(request)).toString();
}

export async function readJsonOrThrow(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === "string" ? payload.detail : fallbackMessage;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  return payload;
}
