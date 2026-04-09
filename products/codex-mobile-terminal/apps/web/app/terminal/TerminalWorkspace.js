"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import TerminalSurface from "./TerminalSurface";

const DEVICE_CODE_PATTERN = /\b[A-Z0-9]{4,5}-[A-Z0-9]{4,5}\b/;

const controls = [
  { label: "Esc", input: "\u001b" },
  { label: "Tab", input: "\t" },
  { label: "Ctrl+C", input: "\u0003" },
  { label: "GPT-5.4", input: "c54\n" },
  { label: "Login", input: "codex login\n" },
  { label: "Paste", action: "paste" },
  { label: "Select", action: "select-all" },
  { label: "Up", input: "\u001b[A" },
  { label: "Down", input: "\u001b[B" },
  { label: "Left", input: "\u001b[D" },
  { label: "Right", input: "\u001b[C" },
  { label: "Copy", action: "copy" },
  { label: "Codex", input: "codex\n" },
  { label: "Reset", action: "reset" }
];

export default function TerminalWorkspace({ bridgeWsUrl, sessionStatus }) {
  const terminalRef = useRef(null);
  const composerRef = useRef(null);
  const shellRef = useRef(null);
  const dockRef = useRef(null);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [controlsOpen, setControlsOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [inputMode, setInputMode] = useState("command");
  const [inputFocused, setInputFocused] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [readableOutput, setReadableOutput] = useState({
    links: [],
    lines: []
  });
  const [browserLoginLoading, setBrowserLoginLoading] = useState(false);
  const [connectionState, setConnectionState] = useState({
    status: sessionStatus?.ok ? "Connecting" : "Bridge unavailable",
    connected: false,
    queued: 0
  });

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyPosition: body.style.position,
      bodyWidth: body.style.width
    };

    html.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.height = "100%";
    body.style.position = "fixed";
    body.style.width = "100%";

    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.height = previous.htmlHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.height = previous.bodyHeight;
      body.style.position = previous.bodyPosition;
      body.style.width = previous.bodyWidth;
    };
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    const dock = dockRef.current;

    if (!shell || !dock) {
      return;
    }

    const syncDockHeight = () => {
      shell.style.setProperty("--terminal-dock-height", `${dock.offsetHeight}px`);
    };

    const syncViewport = () => {
      const viewport = window.visualViewport;
      if (!viewport) {
        return;
      }

      const keyboardHeight = Math.max(
        0,
        Math.round(window.innerHeight - viewport.height - viewport.offsetTop)
      );
      const isKeyboardOpen = keyboardHeight > 120;

      shell.dataset.keyboard = isKeyboardOpen ? "open" : "closed";
      shell.dataset.composer = composerOpen ? "open" : "closed";
      shell.style.setProperty("--keyboard-offset", `${Math.max(0, keyboardHeight)}px`);
      shell.style.setProperty("--terminal-safe-bottom", "calc(env(safe-area-inset-bottom, 0px) + 8px)");
      setKeyboardOpen(isKeyboardOpen);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncDockHeight();
    });

    resizeObserver.observe(dock);
    syncDockHeight();
    syncViewport();

    window.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("resize", syncViewport);
    };
  }, [composerOpen]);

  async function handleControl(control) {
    if (!terminalRef.current) {
      return;
    }

    if (control.input) {
      const result = terminalRef.current.sendKey(control.input);
      if (result?.queued) {
        setNotice("Connection is recovering. Command queued and will send after reconnect.");
      }
      return;
    }

    if (control.action === "paste") {
      const result = await terminalRef.current.pasteFromClipboard();
      setNotice(result.ok ? "Clipboard pasted" : result.reason);
      return;
    }

    if (control.action === "select-all") {
      terminalRef.current.selectAll();
      setNotice("Terminal text selected. Use Copy to save it.");
      return;
    }

    if (control.action === "copy") {
      const result = await terminalRef.current.copySelection();
      if (result.ok) {
        terminalRef.current.clearSelection();
      }
      setNotice(result.ok ? "Selection copied" : result.reason);
      return;
    }

    if (control.action === "reset") {
      const result = await terminalRef.current.resetSession();
      setNotice(result.ok ? "Session reset. Reconnect in a moment." : result.reason);
      if (!inputFocused) {
        terminalRef.current.focus();
      }
    }
  }

  function submitDraft(event) {
    event.preventDefault();

    if (!terminalRef.current) {
      return;
    }

    if (!draft.trim()) {
      composerRef.current?.focus();
      return;
    }

    if (inputMode === "raw") {
      const result = terminalRef.current.sendKey(draft);
      if (result?.queued) {
        setNotice("Connection is recovering. Raw input queued.");
      }
    } else {
      const result = terminalRef.current.sendInput(`${draft}\n`);
      if (result?.queued) {
        setNotice("Connection is recovering. Command queued and will run after reconnect.");
      }
    }
    setDraft("");
    setComposerOpen(false);
    composerRef.current?.blur();
    terminalRef.current?.focus();
  }

  function handleComposerKeyDown(event) {
    if (inputMode === "raw" && event.key === "Enter") {
      event.preventDefault();
      submitDraft(event);
      return;
    }

    if (inputMode === "command") {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        terminalRef.current?.sendKey("\u001b[A");
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        terminalRef.current?.sendKey("\u001b[B");
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        terminalRef.current?.sendKey("\u001b");
      }
    }
  }

  function sendRaw(data) {
    terminalRef.current?.sendKey(data);
  }

  async function copyText(value, noticeText) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(noticeText);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Clipboard write failed");
    }
  }

  async function triggerBrowserLogin() {
    if (browserLoginLoading) {
      return;
    }

    setBrowserLoginLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/chatgpt-login", {
        method: "POST",
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "chatgpt_login_failed");
      }

      const lines = Array.isArray(payload?.auth?.lines) ? payload.auth.lines : [];
      const links = payload?.auth?.url ? [payload.auth.url] : [];
      if (lines.length || links.length) {
        setReadableOutput((current) => ({
          lines: lines.length ? lines : current.lines,
          links: links.length ? links : current.links
        }));
      }

      if (payload?.auth?.url || payload?.auth?.code) {
        setNotice("ChatGPT device login is ready below.");
      } else {
        setNotice("Login started, but link is not visible yet. Wait a moment and try again.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ChatGPT login failed");
    } finally {
      setBrowserLoginLoading(false);
    }
  }

  const latestDeviceCode =
    [...readableOutput.lines]
      .reverse()
      .map((line) => line.match(DEVICE_CODE_PATTERN)?.[0] || "")
      .find(Boolean) || "";

  const latestLoginLink =
    readableOutput.links.find((link) => /auth\.openai\.com\/codex\/device/i.test(link)) ||
    readableOutput.links[0] ||
    "";

  return (
    <main
      className="terminal-shell terminal-shell--fullscreen"
      data-composer={composerOpen ? "open" : "closed"}
      data-keyboard={keyboardOpen ? "open" : "closed"}
      ref={shellRef}
    >
      <section className="terminal-frame terminal-frame--fullscreen">
        <div className="terminal-surface terminal-surface--fullscreen">
          <TerminalSurface
            bridgeWsUrl={bridgeWsUrl}
            onConnectionStateChange={setConnectionState}
            onReadableOutputChange={setReadableOutput}
            ref={terminalRef}
          />
        </div>
      </section>

      <div className="terminal-dock" ref={dockRef}>
        {controlsOpen ? (
          <div className="terminal-controls-panel">
            {controls.map((control) => (
              <button
                className="terminal-control-button"
                key={control.label}
                onClick={() => handleControl(control)}
                type="button"
              >
                {control.label}
              </button>
            ))}
            <button
              className="terminal-control-button terminal-control-button--danger"
              onClick={() => sendRaw("clear\n")}
              type="button"
            >
              Clear
            </button>
          </div>
        ) : null}

        <div className="terminal-composer terminal-composer--launcher">
          <button
            aria-label="Toggle terminal controls"
            className={`terminal-toggle${controlsOpen ? " is-open" : ""}`}
            onClick={() => setControlsOpen((value) => !value)}
            type="button"
          >
            +
          </button>
          <button
            className="terminal-type-button"
            onClick={() => {
              setComposerOpen(true);
              setTimeout(() => composerRef.current?.focus(), 10);
            }}
            type="button"
          >
            Type
          </button>
        </div>

        {composerOpen ? (
          <form className="terminal-compose-sheet" onSubmit={submitDraft}>
            <input
              className="terminal-input"
              enterKeyHint="send"
              onBlur={() => setInputFocused(false)}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={() => setInputFocused(true)}
              onKeyDown={handleComposerKeyDown}
              placeholder={
                inputMode === "raw"
                  ? "Raw mode: send text chunks into terminal"
                  : "Command mode: press Enter to run"
              }
              ref={composerRef}
              spellCheck={false}
              type="text"
              value={draft}
            />
            <button className="terminal-sheet-action" type="submit">
              Send
            </button>
            <button
              className="terminal-sheet-action terminal-sheet-action--ghost"
              onClick={() => {
                setComposerOpen(false);
                composerRef.current?.blur();
                terminalRef.current?.focus();
              }}
              type="button"
            >
              Close
            </button>
          </form>
        ) : null}

        {notice ? <div className="terminal-notice">{notice}</div> : null}

        {!connectionState.connected || connectionState.queued ? (
          <div className="terminal-notice">
            {connectionState.connected
              ? `Connected. ${connectionState.queued} queued input item(s) waiting to flush.`
              : `Bridge state: ${connectionState.status}. ${
                  connectionState.queued
                    ? `${connectionState.queued} input item(s) queued for reconnect.`
                    : "New input may queue until reconnect."
                }`}
          </div>
        ) : null}

        {readableOutput.links.length || readableOutput.lines.length ? (
          <section className="terminal-readable-panel">
            <div className="terminal-readable-header">
              <span className="terminal-readable-title">Recent terminal output</span>
              {readableOutput.lines.length ? (
                <button
                  className="terminal-helper-chip"
                  onClick={() => copyText(readableOutput.lines.join("\n"), "Recent output copied")}
                  type="button"
                >
                  Copy Output
                </button>
              ) : null}
            </div>

            {readableOutput.links.length ? (
              <div className="terminal-readable-links">
                {readableOutput.links.map((link) => (
                  <div className="terminal-readable-link-row" key={link}>
                    <a
                      className="terminal-helper-link"
                      href={link}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {link}
                    </a>
                    <button
                      className="terminal-helper-chip"
                      onClick={() => copyText(link, "Login link copied")}
                      type="button"
                    >
                      Copy Link
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {readableOutput.lines.length ? (
              <pre className="terminal-readable-output">
                {readableOutput.lines.join("\n")}
              </pre>
            ) : null}
          </section>
        ) : null}

        {latestLoginLink || latestDeviceCode ? (
          <section className="terminal-readable-panel">
            <div className="terminal-readable-header">
              <span className="terminal-readable-title">ChatGPT Login Helper</span>
            </div>
            {latestLoginLink ? (
              <div className="terminal-readable-link-row">
                <a
                  className="terminal-helper-link"
                  href={latestLoginLink}
                  rel="noreferrer"
                  target="_blank"
                >
                  {latestLoginLink}
                </a>
                <button
                  className="terminal-helper-chip"
                  onClick={() => copyText(latestLoginLink, "Login link copied")}
                  type="button"
                >
                  Copy Link
                </button>
              </div>
            ) : null}
            {latestDeviceCode ? (
              <div className="terminal-readable-link-row">
                <span className="terminal-readable-title">{latestDeviceCode}</span>
                <button
                  className="terminal-helper-chip"
                  onClick={() => copyText(latestDeviceCode, "Device code copied")}
                  type="button"
                >
                  Copy Code
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {controlsOpen ? (
          <div className="terminal-helper-links">
            <button
              className={`terminal-helper-chip${inputMode === "raw" ? " is-active" : ""}`}
              onClick={() =>
                setInputMode((current) => (current === "command" ? "raw" : "command"))
              }
              type="button"
            >
              {inputMode === "raw" ? "Raw Mode" : "Command Mode"}
            </button>
            <button
              className="terminal-helper-chip"
              onClick={() => {
                composerRef.current?.blur();
                terminalRef.current?.focus();
              }}
              type="button"
            >
              Focus Terminal
            </button>
            <button
              className="terminal-helper-chip"
              onClick={triggerBrowserLogin}
              type="button"
            >
              {browserLoginLoading ? "Starting Login..." : "Login"}
            </button>
            <button
              className="terminal-helper-chip"
              onClick={triggerBrowserLogin}
              type="button"
            >
              {browserLoginLoading ? "Preparing..." : "Browser Login"}
            </button>
            <Link className="terminal-helper-link" href="/console">
              Console
            </Link>
            <span className="terminal-helper-text">Use Browser Login, then open the link below.</span>
          </div>
        ) : null}
      </div>
    </main>
  );
}
