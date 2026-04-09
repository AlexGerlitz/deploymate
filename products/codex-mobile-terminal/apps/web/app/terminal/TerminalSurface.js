"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;

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

function extractLinks(text) {
  const matches = text.match(URL_PATTERN) || [];
  return [...new Set(matches)].slice(-6);
}

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

const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_TIMEOUT_MS = 45000;

const TerminalSurface = forwardRef(function TerminalSurface(
  { bridgeWsUrl, onReadableOutputChange, onConnectionStateChange },
  ref
) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const isResettingRef = useRef(false);
  const shouldRefocusTerminalRef = useRef(false);
  const lastResizeRef = useRef({ cols: 0, rows: 0 });
  const touchStateRef = useRef({
    active: false,
    startY: 0,
    startScrollTop: 0,
    lastY: 0,
    lastAt: 0,
    velocity: 0,
    momentumFrame: 0
  });
  const initialViewportSettledRef = useRef(false);
  const [status, setStatus] = useState("Connecting");
  const [statusTone, setStatusTone] = useState("muted");
  const plainTextBufferRef = useRef("");
  const pendingInputQueueRef = useRef([]);
  const recentOutputRef = useRef({
    links: [],
    lines: []
  });

  function publishConnectionState(nextStatus, connected, queued = pendingInputQueueRef.current.length) {
    onConnectionStateChange?.({
      status: nextStatus,
      connected,
      queued
    });
  }

  function publishReadableOutput(nextBuffer) {
    const lines = nextBuffer
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim())
      .slice(-12);
    const links = extractLinks(nextBuffer);
    const previous = recentOutputRef.current;

    const unchanged =
      previous.links.join("\n") === links.join("\n") &&
      previous.lines.join("\n") === lines.join("\n");

    if (unchanged) {
      return;
    }

    const nextOutput = { links, lines };
    recentOutputRef.current = nextOutput;
    onReadableOutputChange?.(nextOutput);
  }

  function recordPlainText(chunk) {
    const cleaned = stripAnsi(chunk);
    if (!cleaned) {
      return;
    }

    plainTextBufferRef.current = `${plainTextBufferRef.current}${cleaned}`.slice(-16000);
    publishReadableOutput(plainTextBufferRef.current);
  }

  function flushPendingInput() {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }

    while (pendingInputQueueRef.current.length) {
      const data = pendingInputQueueRef.current.shift();
      socketRef.current.send(JSON.stringify({ type: "input", data }));
    }
    publishConnectionState("Connected", true, 0);
  }

  function enqueueOrSendInput(data) {
    if (!data) {
      return { ok: false, queued: false, reason: "empty_input" };
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "input", data }));
      publishConnectionState(status, true, pendingInputQueueRef.current.length);
      return { ok: true, queued: false };
    }

    pendingInputQueueRef.current.push(data);
    if (pendingInputQueueRef.current.length > 24) {
      pendingInputQueueRef.current = pendingInputQueueRef.current.slice(-24);
    }
    publishConnectionState(status, false, pendingInputQueueRef.current.length);
    return { ok: true, queued: true, reason: "queued_until_reconnect" };
  }

  useImperativeHandle(ref, () => ({
    sendInput(data) {
      return enqueueOrSendInput(data);
    },
    async pasteFromClipboard() {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          return enqueueOrSendInput(text);
        }
        return { ok: false, reason: "Clipboard is empty" };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : "Clipboard read failed"
        };
      }
    },
    async copySelection() {
      const term = xtermRef.current;
      const selection = term?.getSelection?.() || "";
      if (!selection) {
        return { ok: false, reason: "Nothing selected" };
      }
      try {
        await navigator.clipboard.writeText(selection);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          reason: error instanceof Error ? error.message : "Clipboard write failed"
        };
      }
    },
    selectAll() {
      xtermRef.current?.selectAll();
    },
    clearSelection() {
      xtermRef.current?.clearSelection();
    },
    focus() {
      shouldRefocusTerminalRef.current = true;
      xtermRef.current?.focus();
    },
    sendKey(data) {
      xtermRef.current?.focus();
      return enqueueOrSendInput(data);
    },
    async resetSession() {
      isResettingRef.current = true;
      const response = await fetch("/api/session/reset", {
        method: "POST",
        cache: "no-store"
      });

      if (!response.ok) {
        return { ok: false, reason: "Reset request failed" };
      }

      return { ok: true };
    },
    getConnectionState() {
      return {
        status,
        connected: socketRef.current?.readyState === WebSocket.OPEN,
        queued: pendingInputQueueRef.current.length
      };
    }
  }), [status]);

  useEffect(() => {
    publishConnectionState(status, socketRef.current?.readyState === WebSocket.OPEN, pendingInputQueueRef.current.length);
  }, [status]);

  useEffect(() => {
    let terminal = null;
    let fitAddon = null;
    let resizeObserver = null;
    let cancelled = false;
    let resizeFrame = 0;
    let viewport = null;

    if (!terminalRef.current || xtermRef.current) {
      return;
    }

    const syncSize = () => {
      if (fitAddon) {
        fitAddon.fit();
        if (socketRef.current?.readyState === WebSocket.OPEN && terminal) {
          lastResizeRef.current = {
            cols: terminal.cols,
            rows: terminal.rows
          };
          socketRef.current.send(
            JSON.stringify({
              type: "resize",
              cols: terminal.cols,
              rows: terminal.rows
            })
          );
        }
      }
    };

    const scheduleSyncSize = () => {
      if (resizeFrame) {
        cancelAnimationFrame(resizeFrame);
      }

      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        syncSize();
      });
    };

    const queueReconnect = (delay = 700) => {
      if (cancelled || reconnectTimerRef.current) {
        return;
      }

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!cancelled && terminal) {
          connectSocket(terminal);
        }
      }, delay);
    };

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
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.close();
        }
      }, HEARTBEAT_TIMEOUT_MS);
    };

    const startHeartbeat = () => {
      clearHeartbeat();
      markHeartbeat();
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    const stopMomentum = () => {
      if (touchStateRef.current.momentumFrame) {
        cancelAnimationFrame(touchStateRef.current.momentumFrame);
        touchStateRef.current.momentumFrame = 0;
      }
    };

    const startMomentum = () => {
      if (!viewport) {
        return;
      }

      stopMomentum();

      const step = () => {
        if (!viewport) {
          touchStateRef.current.momentumFrame = 0;
          return;
        }

        touchStateRef.current.velocity *= 0.94;
        if (Math.abs(touchStateRef.current.velocity) < 0.15) {
          touchStateRef.current.momentumFrame = 0;
          return;
        }

        viewport.scrollTop += touchStateRef.current.velocity * 16;
        touchStateRef.current.momentumFrame = requestAnimationFrame(step);
      };

      touchStateRef.current.momentumFrame = requestAnimationFrame(step);
    };

    const handleTouchStart = (event) => {
      if (!viewport || event.touches.length !== 1) {
        return;
      }

      stopMomentum();

      const touch = event.touches[0];
      touchStateRef.current.active = true;
      touchStateRef.current.startY = touch.clientY;
      touchStateRef.current.startScrollTop = viewport.scrollTop;
      touchStateRef.current.lastY = touch.clientY;
      touchStateRef.current.lastAt = performance.now();
      touchStateRef.current.velocity = 0;
    };

    const handleTouchMove = (event) => {
      if (!viewport || !touchStateRef.current.active || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const deltaY = touch.clientY - touchStateRef.current.startY;
      viewport.scrollTop = touchStateRef.current.startScrollTop - deltaY;

      const now = performance.now();
      const dt = Math.max(1, now - touchStateRef.current.lastAt);
      const dy = touchStateRef.current.lastY - touch.clientY;
      touchStateRef.current.velocity = dy / dt;
      touchStateRef.current.lastY = touch.clientY;
      touchStateRef.current.lastAt = now;

      event.preventDefault();
    };

    const handleTouchEnd = () => {
      if (!touchStateRef.current.active) {
        return;
      }

      touchStateRef.current.active = false;
      startMomentum();
    };

    async function bootTerminal() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit")
      ]);

      if (cancelled || !terminalRef.current) {
        return;
      }

      terminal = new Terminal({
        cursorBlink: true,
        fontFamily:
          'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, monospace',
        fontSize: 12.5,
        lineHeight: 1.1,
        scrollback: 7000,
        convertEol: true,
        allowTransparency: true,
        letterSpacing: 0,
        customGlyphs: false,
        theme: {
          background: "#0b0e12",
          foreground: "#f2f5f7",
          cursor: "#f2f5f7",
          cursorAccent: "#0b0e12",
          selectionBackground: "rgba(121, 192, 255, 0.28)",
          black: "#0b0e12",
          brightBlack: "#5b6672",
          red: "#ff7b72",
          green: "#56d364",
          yellow: "#e3b341",
          blue: "#79c0ff",
          magenta: "#d2a8ff",
          cyan: "#39c5cf",
          white: "#c9d1d9",
          brightWhite: "#f0f6fc",
          brightRed: "#ffa198",
          brightGreen: "#7ee787",
          brightYellow: "#f2cc60",
          brightBlue: "#a5d6ff",
          brightMagenta: "#e2c5ff",
          brightCyan: "#73dce5"
        }
      });
      fitAddon = new FitAddon();

      terminal.loadAddon(fitAddon);
      terminal.open(terminalRef.current);
      viewport = terminalRef.current.querySelector(".xterm-viewport");
      if (viewport) {
        viewport.scrollTop = 0;
      }
      scheduleSyncSize();

      xtermRef.current = terminal;

      terminal.onData((data) => {
        enqueueOrSendInput(data);
      });

      resizeObserver = new ResizeObserver(() => {
        scheduleSyncSize();
      });
      resizeObserver.observe(terminalRef.current);

      if (viewport) {
        viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
        viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
        viewport.addEventListener("touchend", handleTouchEnd, { passive: true });
        viewport.addEventListener("touchcancel", handleTouchEnd, { passive: true });
      }

      window.addEventListener("resize", scheduleSyncSize);
      window.visualViewport?.addEventListener("resize", scheduleSyncSize);

      connectSocket(terminal);
    }

    function connectSocket(term) {
      const configuredUrl = deriveBridgeWsUrl(bridgeWsUrl);

      if (!configuredUrl) {
        setStatus("Bridge URL unavailable");
        setStatusTone("warn");
        term.writeln("\r\n[bridge] websocket URL is not set.");
        return;
      }

      const ws = new WebSocket(configuredUrl);
      socketRef.current = ws;

      ws.addEventListener("open", () => {
        setStatus("Connected");
        setStatusTone("ok");
        publishConnectionState("Connected", true, pendingInputQueueRef.current.length);
        startHeartbeat();
        if (shouldRefocusTerminalRef.current) {
          term.focus();
          shouldRefocusTerminalRef.current = false;
        }
        const { cols, rows } = lastResizeRef.current;
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: cols || term.cols,
            rows: rows || term.rows
          })
        );
        flushPendingInput();
      });

      ws.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data);
          markHeartbeat();

          if (message.type === "pong") {
            return;
          }

          if (message.type === "output" && typeof message.data === "string") {
            term.write(message.data);
            recordPlainText(message.data);
            if (viewport && !initialViewportSettledRef.current) {
              viewport.scrollTop = 0;
            }
          }

          if (message.type === "session-ready") {
            setStatus("Connected");
            setStatusTone("ok");
            if (viewport && !initialViewportSettledRef.current) {
              viewport.scrollTop = 0;
              initialViewportSettledRef.current = true;
            }
            if (isResettingRef.current) {
              term.writeln("\r\n[bridge] session restarted.");
              isResettingRef.current = false;
              if (shouldRefocusTerminalRef.current) {
                term.focus();
                shouldRefocusTerminalRef.current = false;
              }
            }
          }

          if (message.type === "session-exit") {
            setStatus("Reconnecting");
            setStatusTone("muted");
            publishConnectionState("Reconnecting", false, pendingInputQueueRef.current.length);
            if (!isResettingRef.current) {
              term.writeln("\r\n[bridge] session exited, reconnecting...");
              recordPlainText("[bridge] session exited, reconnecting...\n");
            }
          }

          if (message.type === "bridge-error") {
            setStatus("Bridge error");
            setStatusTone("warn");
            publishConnectionState("Bridge error", false, pendingInputQueueRef.current.length);
            term.writeln(`\r\n[bridge] ${message.message}`);
            recordPlainText(`[bridge] ${message.message}\n`);
          }
        } catch {
          term.writeln("\r\n[bridge] invalid message");
          recordPlainText("[bridge] invalid message\n");
        }
      });

      ws.addEventListener("close", () => {
        clearHeartbeat();
        const resetFlow = isResettingRef.current;
        setStatus(resetFlow ? "Restarting" : "Reconnecting");
        setStatusTone("muted");
        publishConnectionState(resetFlow ? "Restarting" : "Reconnecting", false, pendingInputQueueRef.current.length);
        if (!resetFlow) {
          term.writeln("\r\n[bridge] websocket disconnected, reconnecting...");
          recordPlainText("[bridge] websocket disconnected, reconnecting...\n");
        }
        shouldRefocusTerminalRef.current = true;
        queueReconnect(resetFlow ? 250 : 900);
      });

      ws.addEventListener("error", () => {
        clearHeartbeat();
        setStatus("Connection failed");
        setStatusTone("warn");
        publishConnectionState("Connection failed", false, pendingInputQueueRef.current.length);
        queueReconnect(1400);
      });
    }

    bootTerminal();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearHeartbeat();
      if (resizeFrame) {
        cancelAnimationFrame(resizeFrame);
      }
      stopMomentum();
      window.removeEventListener("resize", scheduleSyncSize);
      window.visualViewport?.removeEventListener("resize", scheduleSyncSize);
      resizeObserver?.disconnect();
      if (viewport) {
        viewport.removeEventListener("touchstart", handleTouchStart);
        viewport.removeEventListener("touchmove", handleTouchMove);
        viewport.removeEventListener("touchend", handleTouchEnd);
        viewport.removeEventListener("touchcancel", handleTouchEnd);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      if (terminal) {
        terminal.dispose();
      }
      xtermRef.current = null;
    };
  }, []);

  return (
    <div className="terminal-runtime">
      <div className={`terminal-status ${statusTone}`}>{status}</div>
      <div className="terminal-canvas" ref={terminalRef} />
    </div>
  );
});

export default TerminalSurface;
