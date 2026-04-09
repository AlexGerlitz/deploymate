import { headers } from "next/headers";
import MobileTerminalWorkspace from "./MobileTerminalWorkspace";
import TerminalWorkspace from "./TerminalWorkspace";

export const dynamic = "force-dynamic";

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
  const isMobileSafariLike = /iphone|ipad|ipod|android/i.test(userAgent);
  const sessionStatus = await getSessionStatus();
  const bridgeWsUrl = process.env.TERMINAL_SERVER_WS_URL || "";

  if (isMobileSafariLike) {
    return (
      <MobileTerminalWorkspace bridgeWsUrl={bridgeWsUrl} sessionStatus={sessionStatus} />
    );
  }

  return <TerminalWorkspace bridgeWsUrl={bridgeWsUrl} sessionStatus={sessionStatus} />;
}
