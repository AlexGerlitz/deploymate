import { NextResponse } from "next/server";
import { isAuthenticatedRequest } from "../../../../lib/auth";

export async function POST(request) {
  if (!isAuthenticatedRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const configuredApi = process.env.TERMINAL_SERVER_HTTP_URL;

  if (!configuredApi) {
    return NextResponse.json(
      { ok: false, error: "terminal_server_http_url_not_configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${configuredApi}/api/session/reset`, {
      method: "POST",
      cache: "no-store"
    });

    const payload = await response.json().catch(() => ({ ok: false }));

    return NextResponse.json(payload, {
      status: response.ok ? 200 : response.status
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "bridge_unavailable"
      },
      { status: 502 }
    );
  }
}
