import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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

    const name = entry.slice(0, separator).trim();
    const value = normalizeCookieValue(entry.slice(separator + 1));
    const existing = cookies.get(name) || [];
    existing.push(value);
    cookies.set(name, existing);
  }

  return cookies;
}

function inspectToken(token, secret) {
  const normalized = normalizeCookieValue(token);

  if (!normalized || !secret) {
    return { ok: false, reason: "missing" };
  }

  const separator = normalized.lastIndexOf(".");
  if (separator <= 0) {
    return {
      ok: false,
      reason: "missing_separator",
      length: normalized.length,
      digest: createHash("sha256").update(normalized).digest("hex").slice(0, 12)
    };
  }

  const payload = normalized.slice(0, separator);
  const signature = normalized.slice(separator + 1);
  const expected = getSignature(payload, secret);

  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (actualBuffer.length !== expectedBuffer.length) {
    return {
      ok: false,
      reason: "signature_length_mismatch",
      length: normalized.length,
      digest: createHash("sha256").update(normalized).digest("hex").slice(0, 12)
    };
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return {
      ok: false,
      reason: "signature_mismatch",
      length: normalized.length,
      digest: createHash("sha256").update(normalized).digest("hex").slice(0, 12)
    };
  }

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    if (!decoded.includes(":")) {
      return {
        ok: false,
        reason: "payload_invalid",
        length: normalized.length,
        digest: createHash("sha256").update(normalized).digest("hex").slice(0, 12)
      };
    }

    return {
      ok: true,
      reason: "ok",
      length: normalized.length,
      digest: createHash("sha256").update(normalized).digest("hex").slice(0, 12)
    };
  } catch {
    return {
      ok: false,
      reason: "payload_decode_failed",
      length: normalized.length,
      digest: createHash("sha256").update(normalized).digest("hex").slice(0, 12)
    };
  }
}

function isValidToken(token, secret) {
  return inspectToken(token, secret).ok;
}

export function getCookieDebugInfo(cookieHeader) {
  const secret = process.env.WEB_TERMINAL_SESSION_SECRET || "";
  const cookies = parseCookies(cookieHeader);
  const names = [...cookies.keys()];
  const tokens = cookies.get(SESSION_COOKIE) || [];

  return {
    cookieNames: names,
    sessionCookieCount: tokens.length,
    sessionCookieDebug: tokens.map((token) => inspectToken(token, secret))
  };
}

export function isAuthorizedCookie(cookieHeader) {
  const secret = process.env.WEB_TERMINAL_SESSION_SECRET || "";
  if (!secret) {
    return false;
  }

  const tokens = parseCookies(cookieHeader).get(SESSION_COOKIE) || [];
  return tokens.some((token) => isValidToken(token, secret));
}
