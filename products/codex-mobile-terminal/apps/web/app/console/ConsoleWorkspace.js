"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const quickActions = [
  { label: "GPT-5.4", input: "c54\n" },
  { label: "API Key", input: "codex-api-login\n" },
  { label: "Codex", input: "codex\n" },
  { label: "Reset", action: "reset" }
];

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function deriveBridgeWsUrl(explicitUrl) {
  if (explicitUrl) {
    return explicitUrl;
  }

  if (typeof window === "undefined") {
    return "";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
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

function appendChunkToLines(existingLines, chunk) {
  const cleaned = stripAnsi(chunk);
  if (!cleaned) {
    return existingLines;
  }

  const nextLines = existingLines.length ? [...existingLines] : [""];
  const parts = cleaned.split("\n");

  if (!nextLines.length) {
    nextLines.push("");
  }

  nextLines[nextLines.length - 1] += parts[0];

  for (let index = 1; index < parts.length; index += 1) {
    nextLines.push(parts[index]);
  }

  return nextLines.slice(-240);
}

function renderLineWithLinks(line) {
  const segments = line.split(URL_PATTERN);

  return segments.map((segment, index) => {
    if (!segment) {
      return null;
    }

    if (/^https?:\/\//i.test(segment)) {
      return (
        <a
          className="console-inline-link"
          href={segment}
          key={`${segment}-${index}`}
          rel="noreferrer"
          target="_blank"
        >
          {segment}
        </a>
      );
    }

    return <span key={`${segment}-${index}`}>{segment}</span>;
  });
}

function classifyLine(line) {
  if (!line.trim()) {
    return "console-line--muted";
  }

  if (/error|failed|forbidden|denied|traceback|exception/i.test(line)) {
    return "console-line--error";
  }

  if (/connected|ready|success|saved|done|restarted/i.test(line)) {
    return "console-line--success";
  }

  if (/^(cmt:|root@|.+[$#] ?)/.test(line.trim())) {
    return "console-line--prompt";
  }

  if (/https?:\/\//i.test(line)) {
    return "console-line--linkish";
  }

  return "console-line--body";
}

function isPromptLine(line) {
  return /^(cmt:|root@|.+[$#] ?)/.test(line.trim());
}

function buildBlocks(lines) {
  const blocks = [];

  for (const line of lines) {
    const entry = { text: line, tone: classifyLine(line) };

    if (isPromptLine(line)) {
      blocks.push({ kind: "prompt", lines: [entry] });
      continue;
    }

    const lastBlock = blocks[blocks.length - 1];
    if (!lastBlock || lastBlock.kind !== "output") {
      blocks.push({ kind: "output", lines: [entry] });
      continue;
    }

    lastBlock.lines.push(entry);
  }

  return blocks;
}

function detectCodexTui(lines) {
  const recent = lines.slice(-80).join("\n");
  return /OpenAI Codex \(v/i.test(recent) || /model:\s+gpt-/i.test(recent);
}

function formatSessionStartTime(value) {
  if (!value) {
    return "Now";
  }

  const match = value.match(/T(\d{2}:\d{2}:\d{2})/);
  return match ? match[1] : "Now";
}

export default function ConsoleWorkspace({ bridgeWsUrl, initialConsole, sessionStatus }) {
  const [lines, setLines] = useState(initialConsole?.lines || []);
  const [version, setVersion] = useState(initialConsole?.version || 0);
  const [active, setActive] = useState(initialConsole?.active || false);
  const [createdAt, setCreatedAt] = useState(initialConsole?.createdAt || null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [connectionState, setConnectionState] = useState(
    initialConsole?.active ? "live" : "connecting"
  );
  const outputRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const sessionSummary = useMemo(() => {
    const modelLine =
      [...lines].reverse().find((line) => /model:/i.test(line)) || "";
    const modelHint = /gpt-5\.4/i.test(modelLine) || lines.some((line) => /gpt-5\.4/i.test(line))
      ? "GPT-5.4 ready"
      : modelLine || "Codex session ready";
    return {
      active,
      modelHint
    };
  }, [active, lines]);

  const blocks = useMemo(() => buildBlocks(lines), [lines]);
  const codexTuiActive = useMemo(() => detectCodexTui(lines), [lines]);

  useEffect(() => {
    const output = outputRef.current;
    if (!output) {
      return;
    }

    const onScroll = () => {
      const distance = output.scrollHeight - output.scrollTop - output.clientHeight;
      setAutoScroll(distance < 40);
    };

    output.addEventListener("scroll", onScroll);
    return () => {
      output.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!autoScroll) {
      return;
    }

    const output = outputRef.current;
    if (!output) {
      return;
    }

    output.scrollTop = output.scrollHeight;
  }, [lines, autoScroll]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (cancelled) {
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/console", {
          cache: "no-store"
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "console_unavailable");
        }

        if (cancelled) {
          return;
        }

        setVersion(payload.console.version);
        setLines(payload.console.lines || []);
        setActive(Boolean(payload.console.active));
        setCreatedAt(payload.console.createdAt || null);
        if (payload.console.active) {
          setConnectionState("live");
        }
      } catch (error) {
        if (!cancelled) {
          setNotice(error instanceof Error ? error.message : "Console unavailable");
          setConnectionState("reconnecting");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const timer = window.setInterval(refresh, 1200);
    refresh();

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    function queueReconnect() {
      if (cancelled || reconnectTimerRef.current) {
        return;
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!cancelled) {
          connect();
        }
      }, 900);
    }

    function connect() {
      const wsUrl = deriveBridgeWsUrl(bridgeWsUrl);
      if (!wsUrl) {
        return;
      }

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      setConnectionState("connecting");

      socket.addEventListener("open", () => {
        setActive(true);
        setConnectionState("live");
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "output" && typeof payload.data === "string") {
            setLines((current) => appendChunkToLines(current, payload.data));
            setVersion((current) => current + 1);
            return;
          }

          if (payload.type === "session-ready") {
            setActive(true);
            setConnectionState("live");
            if (payload.createdAt) {
              setCreatedAt(payload.createdAt);
            }
            return;
          }

          if (payload.type === "session-exit") {
            setActive(false);
            setConnectionState("reconnecting");
            setNotice("Session restarted. Reconnecting...");
          }
        } catch {
          setNotice("Bridge stream parse failed");
        }
      });

      socket.addEventListener("close", () => {
        setActive(false);
        setConnectionState("reconnecting");
        queueReconnect();
      });

      socket.addEventListener("error", () => {
        setActive(false);
        setConnectionState("reconnecting");
        queueReconnect();
      });
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  async function sendInput(input, successNotice = "") {
    if (!input || sending || codexTuiActive) {
      if (codexTuiActive) {
        setNotice("Codex UI is active. Open Terminal for interactive work.");
      }
      return;
    }

    setSending(true);
    setNotice("");
    try {
      const response = await fetch("/api/console/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({ input })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "send_failed");
      }
      if (successNotice) {
        setNotice(successNotice);
      }
      setDraft("");
      inputRef.current?.focus();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const normalized = draft.trim();
    if (!normalized) {
      return;
    }
    await sendInput(`${normalized}\n`);
  }

  async function handleReset() {
    setNotice("");
    const response = await fetch("/api/session/reset", {
      method: "POST",
      cache: "no-store"
    });

    if (!response.ok) {
      setNotice("Reset failed");
      return;
    }

    setLines([""]);
    setVersion(0);
    setActive(false);
    setConnectionState("reconnecting");
    setNotice("Session reset. Rebuilding shell...");
  }

  return (
    <main className="console-shell">
      <section className="console-topbar">
        <div>
          <p className="console-eyebrow">Codex Mobile Console</p>
          <h1>Console</h1>
        </div>
        <div className="console-status-group">
          <span
            className={`console-pill${
              connectionState === "live"
                ? " is-live"
                : connectionState === "reconnecting"
                  ? " is-warn"
                  : ""
            }`}
          >
            {connectionState === "live"
              ? "Live"
              : connectionState === "reconnecting"
                ? "Reconnecting"
                : "Connecting"}
          </span>
          <span className="console-pill">{loading ? "Syncing" : `v${version}`}</span>
        </div>
      </section>

      <section className="console-summary-grid">
        <span className="console-meta-chip">
          Workspace: {sessionStatus?.session?.workdir || "/workspace"}
        </span>
        <span className="console-meta-chip">
          Model: {sessionSummary.modelHint || "GPT-5.4 ready"}
        </span>
        <span className="console-meta-chip">
          Started: {formatSessionStartTime(createdAt)}
        </span>
      </section>

      {codexTuiActive ? (
        <section className="console-mode-banner">
          <strong>Codex UI is already running in this session.</strong>
          <span>
            This screen is now read-only for viewing output. Open Terminal to interact
            with Codex directly.
          </span>
          <Link className="console-link-button" href="/terminal">
            Open Terminal
          </Link>
        </section>
      ) : null}

      <section className="console-output-card">
        <div className="console-output-toolbar">
          <div className="console-action-row">
            {quickActions.map((action) =>
              action.action === "reset" ? (
                <button
                  className="console-action-button console-action-button--quiet"
                  key={action.label}
                  onClick={handleReset}
                  type="button"
                >
                  {action.label}
                </button>
              ) : (
                <button
                  className="console-action-button"
                  disabled={codexTuiActive}
                  key={action.label}
                  onClick={() =>
                    sendInput(
                      action.input,
                      action.label === "API Key"
                        ? "Paste API key below and press Enter."
                        : ""
                    )
                  }
                  type="button"
                >
                  {action.label}
                </button>
              )
            )}
          </div>
          <div className="console-action-row">
            <Link className="console-link-button" href="https://platform.openai.com/api-keys" rel="noreferrer" target="_blank">
              Get API key
            </Link>
            <Link className="console-link-button" href="/terminal">
              Open Terminal
            </Link>
          </div>
        </div>

        <div className="console-output" ref={outputRef}>
          {blocks.length ? (
            <div className="console-log" role="log">
              {blocks.map((block, blockIndex) => (
                <section
                  className={`console-block console-block--${block.kind}`}
                  key={`${block.kind}-${blockIndex}`}
                >
                  {block.lines.map((line, lineIndex) => (
                    <span
                      className={`console-line ${line.tone}`}
                      key={`${blockIndex}-${lineIndex}-${line.text.slice(0, 24)}`}
                    >
                      {line.text ? renderLineWithLinks(line.text) : " "}
                    </span>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <div className="console-empty">
              Console is empty. Start with <code>GPT-5.4</code> or <code>Codex</code>.
            </div>
          )}
        </div>
      </section>

      <form className="console-composer" onSubmit={handleSubmit}>
        <input
          className="console-input"
          disabled={codexTuiActive}
          enterKeyHint="send"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            codexTuiActive
              ? "Codex UI is active in Terminal"
              : "Write a command or prompt for the current session"
          }
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={draft}
        />
        <button className="console-submit" disabled={sending || codexTuiActive} type="submit">
          {codexTuiActive ? "Open" : "Enter"}
        </button>
      </form>

      {notice ? <div className="console-notice">{notice}</div> : null}
    </main>
  );
}
