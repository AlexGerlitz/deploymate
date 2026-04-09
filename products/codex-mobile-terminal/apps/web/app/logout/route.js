import { NextResponse } from "next/server";
import { isSecureCookieEnabled, SESSION_COOKIE } from "../../lib/auth";

export async function POST(request) {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      location: "/login"
    }
  });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureCookieEnabled(),
    expires: new Date(0)
  });
  return response;
}
