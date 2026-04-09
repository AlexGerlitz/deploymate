import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "cmt_session";

function getSessionSecret() {
  return process.env.WEB_TERMINAL_SESSION_SECRET || "";
}

export function isSecureCookieEnabled() {
  return process.env.WEB_TERMINAL_COOKIE_SECURE === "1";
}

export function getAuthConfig() {
  const username = process.env.WEB_TERMINAL_USERNAME || "";
  const password = process.env.WEB_TERMINAL_PASSWORD || "";
  const sessionSecret = getSessionSecret();

  return {
    username,
    password,
    sessionSecret,
    ready: Boolean(username && password && sessionSecret)
  };
}

function getSignature(value, secret) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createSessionToken(username) {
  const { sessionSecret } = getAuthConfig();
  if (!sessionSecret) {
    throw new Error("web_terminal_session_secret_missing");
  }

  const payload = Buffer.from(`${username}:${Date.now()}`, "utf8").toString("base64url");
  const signature = getSignature(payload, sessionSecret);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token) {
  const { sessionSecret } = getAuthConfig();
  if (!token || !sessionSecret) {
    return false;
  }

  const separator = token.lastIndexOf(".");
  if (separator <= 0) {
    return false;
  }

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = getSignature(payload, sessionSecret);

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

export function isAuthenticatedRequest(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value || "";
  return verifySessionToken(token);
}

export function unauthorizedJson() {
  return Response.json(
    {
      ok: false,
      error: "unauthorized"
    },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
