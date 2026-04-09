import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "cmt_session";

function getSignature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function normalizeCookieValue(value) {
  let normalized = String(value || "").trim();

  if (
    normalized.length >= 2 &&
    normalized.startsWith("\"") &&
    normalized.endsWith("\"")
  ) {
    normalized = normalized.slice(1, -1);
  }

  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the raw value when the client sends a non-standard cookie encoding.
  }

  return normalized;
}

function parseCookies(cookieHeader) {
  const cookies = new Map();

  for (const entry of String(cookieHeader || "").split(";")) {
    const separator = entry.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    cookies.set(
      entry.slice(0, separator).trim(),
      normalizeCookieValue(entry.slice(separator + 1))
    );
  }

  return cookies;
}

export function isAuthorizedCookie(cookieHeader) {
  const secret = process.env.WEB_TERMINAL_SESSION_SECRET || "";
  if (!secret) {
    return false;
  }

  const token = parseCookies(cookieHeader).get(SESSION_COOKIE) || "";
  const separator = token.lastIndexOf(".");
  if (separator <= 0) {
    return false;
  }

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = getSignature(payload, secret);

  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    return decoded.includes(":");
  } catch {
    return false;
  }
}
