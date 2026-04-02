import { NextResponse } from "next/server";


const SESSION_COOKIE_NAME = "deploymate_session";
const PROTECTED_PREFIXES = ["/app", "/deployments", "/change-password"];


function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}


export function middleware(request) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/app") {
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
  }
  return NextResponse.redirect(loginUrl);
}


export const config = {
  matcher: ["/app/:path*", "/deployments/:path*", "/change-password"],
};
