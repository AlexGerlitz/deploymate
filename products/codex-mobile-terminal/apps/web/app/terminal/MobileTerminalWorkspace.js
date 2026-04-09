"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const quickActions = [
  { label: "GPT-5.4", input: "c54\n" },
  { label: "Codex", input: "codex\n" },
  { label: "Enter", input: "\n" },
  { label: "Ctrl+C", input: "\u0003" },
  { label: "Up", input: "\u001b[A" },
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

  nextLines[nextLines.length - 1] += parts[0];

  for (let index = 1; index < parts.length; index += 1) {
    nextLines.push(parts[index]);
  }

  return nextLines.slice(-400);
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

  if (/^(cmt:|root@|.+[$#>] ?)/.test(line.trim())) {
    return "console-line--prompt";
  }

  if (/https?:\/\//i.test(line)) {
    return "console-line--linkish";
  }

  return "console-line--body";
}

function buildBlocks(lines) {
  return lines.map((line, index) => ({
    id: `${index}-${line.slice(0, 24)}`,
    text: line,
    tone: classifyLine(line)
  }));
}

export default function MobileTerminalWorkspace({ bridgeWsUrl, sessionStatus }) {
  const [lines, setLines] = useState([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Connecting");
  const [notice, setNotice] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const outputRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const blocks = useMemo(() => buildBlocks(lines), [lines]);

  useEffect(() => {
    const output = outputRef.current;
    if (!output) {
      return;
    }

    const onScroll = () => {
      const distance = output.scrollHeight - output.scrollTop - output.clientHeight;
      setAutoScroll(distance < 40);
    };

    output.addEventListener("scroll", onScroll, { passive: true });
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

    function queueReconnect(delay = 900) {
      if (cancelled || reconnectTimerRef.current) {
        return;
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!cancelled) {
          connect();
        }
      }, delay);
    }

    function connect() {
      const wsUrl = deriveBridgeWsUrl(bridgeWsUrl);
      if (!wsUrl) {
        setStatus("Bridge unavailable");
        return;
      }

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      setStatus("Connecting");

      socket.addEventListener("open", () => {
        setStatus("Live");
        setNotice("");
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "output" && typeof payload.data === "string") {
            setLines((current) => appendChunkToLines(current, payload.data));
            return;
          }

          if (payload.type === "session-ready") {
            setStatus("Live");
            return;
          }

          if (payload.type === "session-exit") {
            setStatus("Reconnecting");
            setNotice("Session restarted. Reconnecting...");
            return;
          }

          if (payload.type === "bridge-error") {
            setStatus("Bridge error");
            setNotice(payload.message || "bridge_error");
          }
        } catch {
          setNotice("Bridge stream parse failed");
        }
      });

      socket.addEventListener("close", () => {
        setStatus("Reconnecting");
        queueReconnect();
      });

      socket.addEventListener("error", () => {
        setStatus("Reconnecting");
        queueReconnect(1200);
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
  }, [bridgeWsUrl]);

  function sendRaw(input) {
    if (!input) {
      return;
    }

    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setNotice("Connection is recovering. Try again in a moment.");
      return;
    }

    socketRef.current.send(JSON.stringify({ type: "input", data: input }));
    inputRef.current?.focus();
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }

    sendRaw(`${draft}\n`);
    setDraft("");
  }

  async function handleReset() {
    const response = await fetch("/api/session/reset", {
      method: "POST",
      cache: "no-store"
    });

    if (!response.ok) {
      setNotice("Reset failed");
      return;
    }

    setLines([]);
    setStatus("Reconnecting");
    setNotice("Session reset. Rebuilding shell...");
  }

  return (
    <main className="console-shell console-shell--terminal">
      <section className="console-topbar">
        <div>
          <p className="console-eyebrow">Web Terminal</p>
          <h1>Terminal</h1>
        </div>
        <div className="console-status-group">
          <span className={`console-pill${status === "Live" ? " is-live" : " is-warn"}`}>
            {status}
          </span>
        </div>
      </section>

      <section className="console-summary-grid">
        <span className="console-meta-chip">
          Workspace: {sessionStatus?.session?.workdir || "/workspace"}
        </span>
        <Link className="console-link-button" href="/console">
          Open Console
        </Link>
      </section>

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
                  key={action.label}
                  onClick={() => sendRaw(action.input)}
                  type="button"
                >
                  {action.label}
                </button>
              )
            )}
          </div>
        </div>

        <div className="console-output console-output--terminal" ref={outputRef}>
          {blocks.length ? (
            <div className="console-log" role="log">
              {blocks.map((line) => (
                <span className={`console-line ${line.tone}`} key={line.id}>
                  {line.text ? renderLineWithLinks(line.text) : " "}
                </span>
              ))}
            </div>
          ) : (
            <div className="console-empty">
              Waiting for terminal output...
            </div>
          )}
        </div>
      </section>

      <form className="console-composer console-composer--terminal" onSubmit={handleSubmit}>
        <input
          className="console-input"
          enterKeyHint="send"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write to terminal"
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={draft}
        />
        <button className="console-submit" type="submit">
          Send
        </button>
      </form>

      {notice ? <div className="console-notice">{notice}</div> : null}
    </main>
  );
}
