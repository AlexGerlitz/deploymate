"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_TIMEOUT_MS = 45000;
const MAX_LINES = 500;

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

  return nextLines.slice(-MAX_LINES);
}

export function renderLineWithLinks(line) {
  const segments = line.split(URL_PATTERN);

  return segments.map((segment, index) => {
    if (!segment) {
      return null;
    }

    if (/^https?:\/\//i.test(segment)) {
      return {
        type: "link",
        value: segment,
        key: `${segment}-${index}`
      };
    }

    return {
      type: "text",
      value: segment,
      key: `${segment}-${index}`
    };
  });
}

export function classifyLine(line) {
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

export function useTerminalTransportIOS({ bridgeWsUrl }) {
  const [lines, setLines] = useState([]);
  const [connectionState, setConnectionState] = useState("connecting");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [focusVersion, setFocusVersion] = useState(0);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const chunkBufferRef = useRef([]);
  const flushFrameRef = useRef(0);
  const pollTimerRef = useRef(null);

  const codexTuiActive = useMemo(() => {
    const recent = lines.slice(-120).join("\n");
    return /OpenAI Codex \(v/i.test(recent) || /Would you like to run the following command\?/i.test(recent);
  }, [lines]);

  const blocks = useMemo(
    () =>
      lines.map((line, index) => ({
        id: `${index}-${line.slice(0, 24)}`,
        text: line,
        tone: classifyLine(line)
      })),
    [lines]
  );

  const flushBufferedOutput = useCallback(() => {
    flushFrameRef.current = 0;
    if (!chunkBufferRef.current.length) {
      return;
    }

    const chunks = chunkBufferRef.current.splice(0);
    setLines((current) => chunks.reduce((acc, chunk) => appendChunkToLines(acc, chunk), current));
  }, []);

  const queueOutput = useCallback(
    (chunk) => {
      chunkBufferRef.current.push(chunk);
      if (!flushFrameRef.current) {
        flushFrameRef.current = window.requestAnimationFrame(flushBufferedOutput);
      }
    },
    [flushBufferedOutput]
  );

  const fetchSnapshot = useCallback(async () => {
    try {
      const response = await fetch("/api/console", {
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "console_unavailable");
      }

      setLines(payload.console.lines || []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Console unavailable");
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    let cancelled = false;
    let reconnectDelay = 800;

    const clearHeartbeat = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
    };

    const markHeartbeat = () => {
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }

      heartbeatTimeoutRef.current = window.setTimeout(() => {
        socketRef.current?.close();
      }, HEARTBEAT_TIMEOUT_MS);
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimerRef.current) {
        return;
      }

      setConnectionState("reconnecting");
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!cancelled) {
          connect();
        }
      }, reconnectDelay);

      reconnectDelay = Math.min(reconnectDelay * 1.6, 4000);
    };

    const startPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }

      pollTimerRef.current = window.setInterval(() => {
        fetchSnapshot();
      }, 1800);
    };

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    function connect() {
      const wsUrl = deriveBridgeWsUrl(bridgeWsUrl);
      if (!wsUrl) {
        setConnectionState("disconnected");
        setNotice("Bridge unavailable");
        startPolling();
        return;
      }

      stopPolling();
      setConnectionState("connecting");
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        reconnectDelay = 800;
        setConnectionState("connected");
        setNotice("");
        setFocusVersion((value) => value + 1);
        markHeartbeat();
        heartbeatIntervalRef.current = window.setInterval(() => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: "ping", ts: Date.now() }));
          }
        }, HEARTBEAT_INTERVAL_MS);
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          markHeartbeat();

          if (payload.type === "pong") {
            return;
          }

          if (payload.type === "output" && typeof payload.data === "string") {
            queueOutput(payload.data);
            return;
          }

          if (payload.type === "session-ready") {
            setConnectionState("connected");
            setFocusVersion((value) => value + 1);
            return;
          }

          if (payload.type === "session-exit") {
            setNotice("Session restarted. Reconnecting...");
            return;
          }

          if (payload.type === "bridge-error") {
            setNotice(payload.message || "bridge_error");
          }
        } catch {
          setNotice("Bridge stream parse failed");
        }
      });

      socket.addEventListener("close", () => {
        clearHeartbeat();
        scheduleReconnect();
        startPolling();
      });

      socket.addEventListener("error", () => {
        clearHeartbeat();
        scheduleReconnect();
        startPolling();
      });
    }

    connect();

    return () => {
      cancelled = true;
      clearHeartbeat();
      stopPolling();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (flushFrameRef.current) {
        cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = 0;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [bridgeWsUrl, fetchSnapshot, queueOutput]);

  const sendInput = useCallback(async (input) => {
    if (!input) {
      return { ok: false, error: "missing_input" };
    }

    setSending(true);
    setNotice("");
    try {
      const response = await fetch("/api/terminal/input", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        cache: "no-store",
        body: JSON.stringify({ input })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "send_failed");
      }

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed";
      setNotice(message);
      return { ok: false, error: message };
    } finally {
      setSending(false);
    }
  }, []);

  return {
    blocks,
    codexTuiActive,
    connectionState,
    focusVersion,
    notice,
    renderLineWithLinks,
    sending,
    sendInput,
    setNotice
  };
}
