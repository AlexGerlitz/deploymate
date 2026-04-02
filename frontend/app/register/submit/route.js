import { NextResponse } from "next/server";

import {
  readJsonOrThrow,
  resolvePublicOrigin,
  resolveServerApiUrl,
} from "../../lib/auth-form-helpers";

function redirectWithError(request, message, username = "") {
  const url = new URL("/register", resolvePublicOrigin(request));
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
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (!username || !password) {
    return redirectWithError(request, "Username and password are required.", username);
  }

  if (password !== confirmPassword) {
    return redirectWithError(request, "Password and confirmation must match.", username);
  }

  try {
    const response = await fetch(resolveServerApiUrl(request, "/auth/register"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
    await readJsonOrThrow(response, "Failed to create account.");
    const nextResponse = NextResponse.redirect(new URL("/app", resolvePublicOrigin(request)), {
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
      error instanceof Error ? error.message : "Failed to create account.",
      username,
    );
  }
}
