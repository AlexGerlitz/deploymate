import { NextResponse } from "next/server";

const SESSION_COOKIE = "cmt_session";

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/terminal") && !pathname.startsWith("/console")) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/terminal/:path*", "/console/:path*"]
};
