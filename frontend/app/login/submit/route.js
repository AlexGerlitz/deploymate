import { NextResponse } from "next/server";

import {
  readJsonOrThrow,
  resolvePublicOrigin,
  resolveServerApiUrl,
} from "../../lib/auth-form-helpers";

function redirectWithError(request, message, username = "") {
  const url = new URL("/login", resolvePublicOrigin(request));
  if (message) {
    url.searchParams.set("error", message);
  }
  if (username) {
    url.searchParams.set("username", username);
  }
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request) {
  const formData = await request.formData();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!username || !password) {
    return redirectWithError(request, "Username and password are required.", username);
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
    const user = await readJsonOrThrow(response, "Failed to log in.");
    const redirectTarget = user.must_change_password ? "/change-password" : "/app";
    const nextResponse = NextResponse.redirect(new URL(redirectTarget, resolvePublicOrigin(request)), {
      status: 303,
    });
    const sessionCookie = response.headers.get("set-cookie");
    if (sessionCookie) {
      nextResponse.headers.append("set-cookie", sessionCookie);
    }
    return nextResponse;
  } catch (error) {
    return redirectWithError(
      request,
      error instanceof Error ? error.message : "Failed to log in.",
      username,
    );
  }
}
