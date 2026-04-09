import { headers } from "next/headers";
import { redirect } from "next/navigation";
import TerminalWorkspace from "./TerminalWorkspace";

export const dynamic = "force-dynamic";

function isMobileSafeUserAgent(userAgent) {
  return /iPhone|iPad|iPod/i.test(userAgent || "");
}

async function getSessionStatus() {
  const configuredApi = process.env.TERMINAL_SERVER_HTTP_URL;
  if (!configuredApi) {
    return {
      ok: false,
      reason: "TERMINAL_SERVER_HTTP_URL is not configured"
    };
  }

  try {
    const response = await fetch(`${configuredApi}/api/session`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, reason: `Bridge returned ${response.status}` };
    }
    const payload = await response.json();
    return {
      ok: true,
      session: payload.session
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Bridge unavailable"
    };
  }
}

export default async function TerminalPage() {
  const userAgent = (await headers()).get("user-agent") || "";
  if (isMobileSafeUserAgent(userAgent)) {
    redirect("/console?mobile=1");
  }

  const sessionStatus = await getSessionStatus();
  const bridgeWsUrl = process.env.TERMINAL_SERVER_WS_URL || "";

  return (
    <TerminalWorkspace bridgeWsUrl={bridgeWsUrl} sessionStatus={sessionStatus} />
  );
}
