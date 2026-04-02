import { NextResponse } from "next/server";

import {
  readJsonOrThrow,
  resolvePublicOrigin,
  resolveServerApiUrl,
} from "../../lib/auth-form-helpers";

function redirectWithError(request, message) {
  const url = new URL("/login", resolvePublicOrigin(request));
  if (message) {
    url.searchParams.set("error", message);
  }
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request) {
  const username =
    process.env.DEPLOYMATE_DEMO_USERNAME ||
    process.env.DEPLOYMATE_ADMIN_USERNAME ||
    "admin";
  const password =
    process.env.DEPLOYMATE_DEMO_PASSWORD ||
    process.env.DEPLOYMATE_ADMIN_PASSWORD ||
    "";

  if (!password) {
    return redirectWithError(request, "Demo access is not configured right now.");
  }

  try {
    const response = await fetch(resolveServerApiUrl(request, "/auth/login"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
    const user = await readJsonOrThrow(response, "Failed to open demo access.");
    const redirectTarget = user.must_change_password ? "/change-password" : "/app";
    const nextResponse = NextResponse.redirect(
      new URL(redirectTarget, resolvePublicOrigin(request)),
      { status: 303 },
    );
    const sessionCookie = response.headers.get("set-cookie");
    if (sessionCookie) {
      nextResponse.headers.append("set-cookie", sessionCookie);
    }
    return nextResponse;
  } catch (error) {
    return redirectWithError(
      request,
      error instanceof Error ? error.message : "Failed to open demo access.",
    );
  }
}
