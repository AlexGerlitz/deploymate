import { isAuthenticatedRequest, unauthorizedJson } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!isAuthenticatedRequest(request)) {
    return unauthorizedJson();
  }

  const configuredApi = process.env.TERMINAL_SERVER_HTTP_URL;

  if (!configuredApi) {
    return Response.json(
      {
        ok: false,
        error: "TERMINAL_SERVER_HTTP_URL is not configured"
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  try {
    const response = await fetch(`${configuredApi}/api/auth/chatgpt-login`, {
      method: "POST",
      cache: "no-store"
    });
    const payload = await response.json();
    return Response.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "bridge_unavailable"
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}
