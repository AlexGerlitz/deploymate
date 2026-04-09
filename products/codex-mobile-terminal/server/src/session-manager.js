import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import pty from "node-pty";

const DEFAULT_SHELL = process.env.TERMINAL_SHELL || process.env.SHELL || "/bin/bash";
const DEFAULT_WORKDIR =
  process.env.TERMINAL_WORKDIR || process.cwd();
const DEFAULT_SESSION_NAME =
  process.env.TERMINAL_TMUX_SESSION || "codex-mobile";
const MAX_BUFFER_CHARS = Number(process.env.TERMINAL_MAX_BUFFER_CHARS || 160000);
const MAX_SNAPSHOT_CHARS = Number(process.env.TERMINAL_MAX_SNAPSHOT_CHARS || 60000);
const AUTH_JSON_PATH = `${process.env.HOME || "/root"}/.codex/auth.json`;
const API_KEY_ENV_PATH =
  process.env.CODEX_API_KEY_ENV_PATH ||
  `${process.env.HOME || "/root"}/.config/codex-mobile-terminal/openai-api-key.env`;

function getTmuxCommand() {
  return `
if command -v tmux >/dev/null 2>&1; then
  tmux -u new-session -A -s ${DEFAULT_SESSION_NAME}
else
  printf '[bridge] tmux is unavailable, starting a plain shell.\\n'
  exec ${DEFAULT_SHELL}
fi
`.trim();
}

function stripAnsi(input) {
  return input
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(
      /[\u001b\u009b][[\]()#;?]*(?:(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~])|(?:[^\u001b]*?\u001b\\))/g,
      ""
    )
    .replace(/\u0008/g, "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function detectCodexTuiText(text) {
  return /OpenAI Codex \(v/i.test(text) || /model:\s+gpt-/i.test(text);
}

function extractDeviceLogin(text) {
  const url = text.match(/https:\/\/auth\.openai\.com\/codex\/device\b[^\s]*/i)?.[0] || "";
  const code = text.match(/\b[A-Z0-9]{4,5}-[A-Z0-9]{4,5}\b/)?.[0] || "";
  return {
    url,
    code
  };
}

function captureTmuxPane() {
  try {
    const output = execFileSync(
      DEFAULT_SHELL,
      [
        "-lc",
        `
for _ in 1 2 3 4 5; do
  out="$(tmux capture-pane -pt ${DEFAULT_SESSION_NAME} -S -240 2>/dev/null || true)"
  if [ -n "$out" ]; then
    printf '%s' "$out"
    break
  fi
  sleep 0.12
done
`.trim()
      ],
      {
        cwd: DEFAULT_WORKDIR,
        encoding: "utf8",
        env: {
          ...process.env,
          LANG: process.env.LANG || "C.UTF-8",
          LC_ALL: process.env.LC_ALL || "C.UTF-8"
        },
        stdio: ["ignore", "pipe", "ignore"]
      }
    );

    return stripAnsi(output);
  } catch {
    return "";
  }
}

export class SessionManager {
  constructor() {
    this.session = null;
    this.clients = new Set();
    this.outputBuffer = "";
    this.outputVersion = 0;
  }

  ensureSession() {
    if (this.session) {
      return this.session;
    }

    const proc = pty.spawn(DEFAULT_SHELL, ["-lc", getTmuxCommand()], {
      name: "xterm-256color",
      cols: 120,
      rows: 32,
      cwd: DEFAULT_WORKDIR,
      env: {
        ...process.env,
        LANG: process.env.LANG || "C.UTF-8",
        LC_ALL: process.env.LC_ALL || "C.UTF-8",
        LC_CTYPE: process.env.LC_CTYPE || "C.UTF-8",
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        CODEX_MOBILE_TERMINAL: "1"
      }
    });

    const session = {
      proc,
      createdAt: new Date().toISOString(),
      bytesRead: 0
    };

    proc.onData((data) => {
      session.bytesRead += Buffer.byteLength(data, "utf8");
      this.appendOutput(data);
      for (const client of this.clients) {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({ type: "output", data }));
        }
      }
    });

    proc.onExit(({ exitCode, signal }) => {
      for (const client of this.clients) {
        if (client.readyState === client.OPEN) {
          client.send(
            JSON.stringify({
              type: "session-exit",
              exitCode,
              signal
            })
          );
        }
      }
      this.session = null;
    });

    this.session = session;
    return session;
  }

  attachClient(ws) {
    this.ensureSession();
    this.clients.add(ws);
    ws.send(
      JSON.stringify({
        type: "session-ready",
        createdAt: this.session.createdAt
      })
    );
  }

  detachClient(ws) {
    this.clients.delete(ws);
  }

  appendOutput(data) {
    const cleaned = stripAnsi(data);
    if (!cleaned) {
      return;
    }

    this.outputBuffer += cleaned;
    if (this.outputBuffer.length > MAX_BUFFER_CHARS) {
      this.outputBuffer = this.outputBuffer.slice(-MAX_BUFFER_CHARS);
    }
    this.outputVersion += 1;
  }

  write(data) {
    if (!this.session) {
      this.ensureSession();
    }
    this.session.proc.write(data);
  }

  resize(cols, rows) {
    if (!this.session) {
      this.ensureSession();
    }
    if (cols > 0 && rows > 0) {
      this.session.proc.resize(cols, rows);
    }
  }

  reset() {
    if (!this.session) {
      return false;
    }

    this.session.proc.kill();
    this.session = null;
    return true;
  }

  getConsoleSnapshot() {
    if (!this.session) {
      this.ensureSession();
    }

    if (!this.outputBuffer.trim()) {
      const pane = captureTmuxPane();
      if (pane.trim()) {
        this.outputBuffer = pane.slice(-MAX_BUFFER_CHARS);
      }
    }

    const text = this.outputBuffer.slice(-MAX_SNAPSHOT_CHARS);
    const lines = text
      .split("\n")
      .slice(-240)
      .map((line) => line.replace(/\s+$/g, ""));

    return {
      version: this.outputVersion,
      active: Boolean(this.session),
      createdAt: this.session?.createdAt || null,
      lines,
      codexTuiActive: detectCodexTuiText(lines.slice(-80).join("\n"))
    };
  }

  isCodexTuiActive() {
    if (!this.session) {
      this.ensureSession();
    }

    const recent = this.outputBuffer.slice(-MAX_SNAPSHOT_CHARS);
    if (recent.trim() && detectCodexTuiText(recent)) {
      return true;
    }

    const pane = captureTmuxPane();
    if (pane.trim()) {
      this.outputBuffer = pane.slice(-MAX_BUFFER_CHARS);
      return detectCodexTuiText(pane);
    }

    return false;
  }

  getStatus() {
    return {
      connectedClients: this.clients.size,
      active: Boolean(this.session),
      createdAt: this.session?.createdAt || null,
      workdir: DEFAULT_WORKDIR,
      shell: DEFAULT_SHELL,
      tmuxSession: DEFAULT_SESSION_NAME
    };
  }

  getAuthStatus() {
    return {
      hasCodexAuth: existsSync(AUTH_JSON_PATH),
      hasApiKey: existsSync(API_KEY_ENV_PATH),
      apiKeyPath: API_KEY_ENV_PATH
    };
  }

  startChatGptLogin() {
    this.ensureSession();

    try {
      execFileSync(
        DEFAULT_SHELL,
        [
          "-lc",
          `
tmux has-session -t ${DEFAULT_SESSION_NAME} 2>/dev/null
tmux send-keys -t ${DEFAULT_SESSION_NAME} C-c
sleep 0.15
tmux send-keys -t ${DEFAULT_SESSION_NAME} "clear" Enter
sleep 0.15
tmux send-keys -t ${DEFAULT_SESSION_NAME} "codex logout" Enter
sleep 0.25
tmux send-keys -t ${DEFAULT_SESSION_NAME} "codex login" Enter
`.trim()
        ],
        {
          cwd: DEFAULT_WORKDIR,
          encoding: "utf8",
          env: {
            ...process.env,
            LANG: process.env.LANG || "C.UTF-8",
            LC_ALL: process.env.LC_ALL || "C.UTF-8"
          },
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
    } catch {
      // We still rely on the pane capture below; send-keys may partially succeed.
    }

    let snapshot = "";
    for (let attempt = 0; attempt < 24; attempt += 1) {
      snapshot = captureTmuxPane();
      const auth = extractDeviceLogin(snapshot);
      if (auth.url || auth.code) {
        break;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }

    const auth = extractDeviceLogin(snapshot);
    return {
      ...auth,
      lines: snapshot
        .split("\n")
        .map((line) => line.trimEnd())
        .filter((line) => line.trim())
        .slice(-40)
    };
  }

  configureApiKey(apiKey, { launchCodex = true } = {}) {
    const dir = dirname(API_KEY_ENV_PATH);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    writeFileSync(API_KEY_ENV_PATH, `export OPENAI_API_KEY=${shellQuote(apiKey)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    chmodSync(API_KEY_ENV_PATH, 0o600);

    const command = launchCodex
      ? `source ${shellQuote(API_KEY_ENV_PATH)} && printenv OPENAI_API_KEY | codex login --with-api-key && codex -m gpt-5.4\n`
      : `source ${shellQuote(API_KEY_ENV_PATH)} && printenv OPENAI_API_KEY | codex login --with-api-key\n`;

    this.write(command);
    return this.getAuthStatus();
  }
}
