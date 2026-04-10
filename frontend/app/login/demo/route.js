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
  const demoAccessEnabled =
    process.env.DEPLOYMATE_DEMO_ACCESS_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_DEMO_ACCESS_ENABLED === "1";
  const username = process.env.DEPLOYMATE_DEMO_USERNAME || "";
  const password = process.env.DEPLOYMATE_DEMO_PASSWORD || "";

  if (!demoAccessEnabled || !username || !password) {
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
