import { NextResponse } from "next/server";

const SESSION_COOKIE = "cmt_session";

function looksLikeSignedSession(value) {
  const token = String(value || "").trim();
  if (!token) {
    return false;
  }

  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) {
    return false;
  }

  return true;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/terminal") && !pathname.startsWith("/console")) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (looksLikeSignedSession(session)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  const response = NextResponse.redirect(loginUrl);
  if (session) {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: "",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      expires: new Date(0)
    });
  }
  return response;
}

export const config = {
  matcher: ["/terminal/:path*", "/console/:path*"]
};
