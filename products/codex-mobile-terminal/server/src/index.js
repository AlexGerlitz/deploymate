import http from "node:http";
import { WebSocketServer } from "ws";
import { isAuthorizedCookie } from "./auth.js";
import { SessionManager } from "./session-manager.js";

const PORT = Number(process.env.PORT || 4020);
const HOST = process.env.HOST || "0.0.0.0";

const sessionManager = new SessionManager();

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, { ok: true, service: "codex-mobile-terminal-server" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/session") {
    json(response, 200, {
      ok: true,
      session: sessionManager.getStatus()
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/status") {
    json(response, 200, {
      ok: true,
      auth: sessionManager.getAuthStatus()
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/chatgpt-login") {
    try {
      const auth = sessionManager.startChatGptLogin();
      json(response, 200, {
        ok: true,
        auth
      });
    } catch (error) {
      json(response, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "chatgpt_login_failed"
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/api-key") {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 40000) {
        request.destroy(new Error("payload_too_large"));
      }
    });

    request.on("error", () => {
      json(response, 400, {
        ok: false,
        error: "invalid_request"
      });
    });

    request.on("end", () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";
        const launchCodex = payload.launchCodex !== false;

        if (!apiKey) {
          json(response, 400, {
            ok: false,
            error: "missing_api_key"
          });
          return;
        }

        sessionManager.configureApiKey(apiKey, { launchCodex });
        json(response, 200, {
          ok: true,
          auth: sessionManager.getAuthStatus()
        });
      } catch {
        json(response, 400, {
          ok: false,
          error: "invalid_json"
        });
      }
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/console") {
    try {
      json(response, 200, {
        ok: true,
        console: sessionManager.getConsoleSnapshot()
      });
    } catch (error) {
      json(response, 503, {
        ok: false,
        error: error instanceof Error ? error.message : "terminal_unavailable"
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/console/send") {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 20000) {
        request.destroy(new Error("payload_too_large"));
      }
    });

    request.on("error", () => {
      json(response, 400, {
        ok: false,
        error: "invalid_request"
      });
    });

    request.on("end", () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const input = typeof payload.input === "string" ? payload.input : "";
        if (!input) {
          json(response, 400, {
            ok: false,
            error: "missing_input"
          });
          return;
        }

        try {
          if (sessionManager.isCodexTuiActive()) {
            json(response, 409, {
              ok: false,
              error: "codex_tui_active_open_terminal"
            });
            return;
          }

          sessionManager.write(input);
          json(response, 200, {
            ok: true
          });
        } catch (error) {
          json(response, 503, {
            ok: false,
            error: error instanceof Error ? error.message : "terminal_unavailable"
          });
        }
      } catch {
        json(response, 400, {
          ok: false,
          error: "invalid_json"
        });
      }
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/session/reset") {
    json(response, 200, {
      ok: true,
      reset: sessionManager.reset()
    });
    return;
  }

  json(response, 404, {
    ok: false,
    error: "not_found"
  });
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname !== "/ws") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  if (!isAuthorizedCookie(request.headers.cookie || "")) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws) => {
  try {
    sessionManager.attachClient(ws);
  } catch (error) {
    ws.send(
      JSON.stringify({
        type: "bridge-error",
        message: error instanceof Error ? error.message : "terminal_unavailable"
      })
    );
    ws.close();
    return;
  }

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === "input" && typeof message.data === "string") {
        sessionManager.write(message.data);
      }

      if (
        message.type === "resize" &&
        Number.isFinite(message.cols) &&
        Number.isFinite(message.rows)
      ) {
        sessionManager.resize(Number(message.cols), Number(message.rows));
      }
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: "bridge-error",
          message: error instanceof Error ? error.message : "unknown_error"
        })
      );
    }
  });

  ws.on("close", () => {
    sessionManager.detachClient(ws);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Web Terminal server listening on ${HOST}:${PORT}`);
});
