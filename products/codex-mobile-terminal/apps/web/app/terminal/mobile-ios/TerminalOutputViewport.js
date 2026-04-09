"use client";

import { useEffect, useRef, useState } from "react";

export default function TerminalOutputViewport({
  blocks,
  renderLineWithLinks,
  onRestoreFocus
}) {
  const outputRef = useRef(null);
  const [autoFollow, setAutoFollow] = useState(true);

  useEffect(() => {
    const output = outputRef.current;
    if (!output) {
      return;
    }

    const onScroll = () => {
      const distance = output.scrollHeight - output.scrollTop - output.clientHeight;
      setAutoFollow(distance < 40);
    };

    output.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      output.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!autoFollow) {
      return;
    }

    const output = outputRef.current;
    if (!output) {
      return;
    }

    output.scrollTop = output.scrollHeight;
  }, [autoFollow, blocks]);

  return (
    <section className="mobile-terminal-ios__output-shell">
      <div
        className="mobile-terminal-ios__output"
        onClick={onRestoreFocus}
        onTouchStart={onRestoreFocus}
        ref={outputRef}
      >
        {blocks.length ? (
          <div className="console-log" role="log">
            {blocks.map((line) => (
              <span className={`console-line ${line.tone}`} key={line.id}>
                {line.text ? (
                  renderLineWithLinks(line.text).map((segment) =>
                    segment?.type === "link" ? (
                      <a
                        className="console-inline-link"
                        href={segment.value}
                        key={segment.key}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {segment.value}
                      </a>
                    ) : (
                      <span key={segment?.key}>{segment?.value}</span>
                    )
                  )
                ) : (
                  " "
                )}
              </span>
            ))}
          </div>
        ) : (
          <div className="console-empty">Waiting for terminal output...</div>
        )}
      </div>
      {!autoFollow ? (
        <button
          className="mobile-terminal-ios__jump"
          onClick={() => {
            const output = outputRef.current;
            if (!output) {
              return;
            }
            output.scrollTop = output.scrollHeight;
            setAutoFollow(true);
            onRestoreFocus?.();
          }}
          type="button"
        >
          Jump to bottom
        </button>
      ) : null}
    </section>
  );
}
