import { NextResponse } from "next/server";
import {
  createSessionToken,
  getAuthConfig,
  isSecureCookieEnabled,
  SESSION_COOKIE
} from "../../../lib/auth";

function getSafeNextPath(nextPath) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/terminal";
  }

  return nextPath;
}

export async function POST(request) {
  const formData = await request.formData();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const remember = String(formData.get("remember") || "") === "yes";
  const nextPath = getSafeNextPath(String(formData.get("next") || "/terminal"));
  const auth = getAuthConfig();

  if (!auth.ready) {
    return new NextResponse(null, {
      status: 303,
      headers: {
        location: `/login?error=server&next=${encodeURIComponent(nextPath)}`
      }
    });
  }

  if (!username || !password) {
    return new NextResponse(null, {
      status: 303,
      headers: {
        location: "/login?error=missing"
      }
    });
  }

  if (username !== auth.username || password !== auth.password) {
    return new NextResponse(null, {
      status: 303,
      headers: {
        location: `/login?error=invalid&next=${encodeURIComponent(nextPath)}`
      }
    });
  }

  const response = new NextResponse(null, {
    status: 303,
    headers: {
      location: nextPath
    }
  });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: createSessionToken(username),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureCookieEnabled(),
    maxAge: remember ? 60 * 60 * 24 * 180 : undefined
  });
  return response;
}
