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

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: "invalid_json"
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  try {
    const response = await fetch(`${configuredApi}/api/console/send`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    return Response.json(body, {
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
