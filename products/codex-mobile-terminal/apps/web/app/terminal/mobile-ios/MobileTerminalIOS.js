"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import MobileTerminalToolbar from "./MobileTerminalToolbar";
import TerminalInputControllerIOS from "./TerminalInputControllerIOS";
import TerminalOutputViewport from "./TerminalOutputViewport";
import { useTerminalTransportIOS } from "./useTerminalTransportIOS";
import { useViewportManagerIOS } from "./useViewportManagerIOS";

function prettyConnectionState(value) {
  switch (value) {
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting";
    case "disconnected":
      return "Disconnected";
    default:
      return "Connecting";
  }
}

export default function MobileTerminalIOS({ bridgeWsUrl, sessionStatus }) {
  const inputControllerRef = useRef(null);
  const [ctrlArmed, setCtrlArmed] = useState(false);
  const { height, keyboardInset } = useViewportManagerIOS();
  const {
    blocks,
    codexTuiActive,
    connectionState,
    focusVersion,
    notice,
    renderLineWithLinks,
    sending,
    sendInput,
    setNotice
  } = useTerminalTransportIOS({ bridgeWsUrl });

  const shellStyle = useMemo(
    () => ({
      height: height ? `${height}px` : undefined,
      "--ios-keyboard-inset": `${keyboardInset}px`
    }),
    [height, keyboardInset]
  );

  async function handleData(data) {
    await sendInput(data);
  }

  return (
    <main className="mobile-terminal-ios" style={shellStyle}>
      <header className="mobile-terminal-ios__header">
        <div>
          <p className="console-eyebrow">Web Terminal</p>
          <h1>iPhone Terminal</h1>
        </div>
        <div className="console-status-group">
          <span
            className={`console-pill${
              connectionState === "connected"
                ? " is-live"
                : connectionState === "reconnecting" || connectionState === "disconnected"
                  ? " is-warn"
                  : ""
            }`}
          >
            {prettyConnectionState(connectionState)}
          </span>
        </div>
      </header>

      <section className="mobile-terminal-ios__meta">
        <span className="console-meta-chip">
          Workspace: {sessionStatus?.session?.workdir || "/workspace"}
        </span>
        <Link className="console-link-button" href="/console">
          Console
        </Link>
        <button
          className="console-action-button console-action-button--quiet"
          onClick={async () => {
            const response = await fetch("/api/session/reset", {
              method: "POST",
              cache: "no-store"
            });
            if (!response.ok) {
              setNotice("Reset failed");
              return;
            }
            setNotice("Session reset. Rebuilding shell...");
            inputControllerRef.current?.focus();
          }}
          type="button"
        >
          Reset
        </button>
      </section>

      <TerminalOutputViewport
        blocks={blocks}
        onRestoreFocus={() => inputControllerRef.current?.focus()}
        renderLineWithLinks={renderLineWithLinks}
      />

      <div className="mobile-terminal-ios__footer">
        <MobileTerminalToolbar
          ctrlArmed={ctrlArmed}
          onArmCtrl={() => {
            setCtrlArmed(true);
            inputControllerRef.current?.focus();
          }}
          onRestoreFocus={() => inputControllerRef.current?.focus()}
          onSend={(input) => handleData(input)}
        />

        <TerminalInputControllerIOS
          ctrlArmed={ctrlArmed}
          disabled={sending}
          focusToken={focusVersion}
          onCtrlConsumed={() => setCtrlArmed(false)}
          onData={handleData}
          ref={inputControllerRef}
          status={
            ctrlArmed
              ? "Ctrl armed"
              : codexTuiActive
                ? "Codex active"
                : prettyConnectionState(connectionState)
          }
        />
      </div>

      {notice ? <div className="mobile-terminal-ios__notice">{notice}</div> : null}
    </main>
  );
}
