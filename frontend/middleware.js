import { NextResponse } from "next/server";


const SESSION_COOKIE_NAME = "deploymate_session";
const PROTECTED_PREFIXES = ["/app", "/deployments", "/change-password"];
const smokeMode = process.env.NEXT_PUBLIC_SMOKE_TEST_MODE === "1";


function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}


export function middleware(request) {
  if (smokeMode) {
    if (request.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(sessionCookie ? "/app" : "/login", request.url));
  }

  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (sessionCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/app") {
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
  }
  return NextResponse.redirect(loginUrl);
}


export const config = {
  matcher: ["/", "/app/:path*", "/deployments/:path*", "/change-password"],
};
