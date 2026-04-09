import ConsoleWorkspace from "./ConsoleWorkspace";

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

async function getConsoleSnapshot() {
  const configuredApi = process.env.TERMINAL_SERVER_HTTP_URL;
  if (!configuredApi) {
    return {
      ok: false,
      reason: "TERMINAL_SERVER_HTTP_URL is not configured",
      console: {
        version: 0,
        active: false,
        createdAt: null,
        lines: []
      }
    };
  }

  try {
    const response = await fetch(`${configuredApi}/api/console`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, reason: `Bridge returned ${response.status}` };
    }
    const payload = await response.json();
    return {
      ok: true,
      console: payload.console
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Bridge unavailable",
      console: {
        version: 0,
        active: false,
        createdAt: null,
        lines: []
      }
    };
  }
}

export default async function ConsolePage() {
  const [sessionStatus, consoleStatus] = await Promise.all([
    getSessionStatus(),
    getConsoleSnapshot()
  ]);
  const bridgeWsUrl = process.env.TERMINAL_SERVER_WS_URL || "";

  return (
    <ConsoleWorkspace
      bridgeWsUrl={bridgeWsUrl}
      initialConsole={consoleStatus.console}
      sessionStatus={sessionStatus}
    />
  );
}
