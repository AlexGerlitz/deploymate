"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

function toCtrlChar(key) {
  const value = String(key || "");
  if (!value) {
    return "";
  }

  if (value === "[") {
    return "\u001b";
  }

  const upper = value.toUpperCase();
  const code = upper.charCodeAt(0);
  if (code >= 64 && code <= 95) {
    return String.fromCharCode(code - 64);
  }

  return "";
}

const specialKeyMap = {
  Enter: "\n",
  Tab: "\t",
  Escape: "\u001b",
  ArrowUp: "\u001b[A",
  ArrowDown: "\u001b[B",
  ArrowLeft: "\u001b[D",
  ArrowRight: "\u001b[C",
  PageUp: "\u001b[5~",
  PageDown: "\u001b[6~",
  Backspace: "\u007f"
};

const TerminalInputControllerIOS = forwardRef(function TerminalInputControllerIOS(
  { ctrlArmed, disabled, focusToken, onCtrlConsumed, onData, status },
  ref
) {
  const textareaRef = useRef(null);
  const composingRef = useRef(false);
  const beforeInputHandledRef = useRef(false);

  function focusInput() {
    if (disabled) {
      return;
    }

    textareaRef.current?.focus({ preventScroll: true });
  }

  function clearInputValue() {
    if (textareaRef.current) {
      textareaRef.current.value = "";
    }
  }

  function emit(data) {
    if (!data || disabled) {
      return;
    }

    onData?.(data);
  }

  function handlePrintable(text) {
    if (!text) {
      return;
    }

    if (ctrlArmed) {
      const first = toCtrlChar(text[0]);
      onCtrlConsumed?.();
      if (first) {
        emit(first);
      }
      if (text.length > 1) {
        emit(text.slice(1));
      }
      return;
    }

    emit(text);
  }

  function handleBeforeInput(event) {
    beforeInputHandledRef.current = true;

    if (disabled || composingRef.current) {
      return;
    }

    const { inputType, data } = event;

    if (inputType === "insertText" && data) {
      event.preventDefault();
      handlePrintable(data);
      clearInputValue();
      return;
    }

    if (inputType === "insertLineBreak" || inputType === "insertParagraph") {
      event.preventDefault();
      emit("\n");
      clearInputValue();
      return;
    }

    if (inputType === "deleteContentBackward") {
      event.preventDefault();
      emit("\u007f");
      clearInputValue();
      return;
    }
  }

  function handleInput(event) {
    if (disabled || composingRef.current) {
      clearInputValue();
      return;
    }

    const value = event.currentTarget.value;
    if (!value) {
      return;
    }

    if (!beforeInputHandledRef.current) {
      handlePrintable(value);
    }

    beforeInputHandledRef.current = false;
    clearInputValue();
  }

  function handleKeyDown(event) {
    if (disabled) {
      return;
    }

    const { key, ctrlKey, metaKey } = event;
    if (metaKey) {
      return;
    }

    if (ctrlArmed && key.length === 1) {
      event.preventDefault();
      const ctrlValue = toCtrlChar(key);
      onCtrlConsumed?.();
      if (ctrlValue) {
        emit(ctrlValue);
      }
      clearInputValue();
      return;
    }

    if (ctrlKey && key.length === 1) {
      event.preventDefault();
      const ctrlValue = toCtrlChar(key);
      if (ctrlValue) {
        emit(ctrlValue);
      }
      clearInputValue();
      return;
    }

    const mapped = specialKeyMap[key];
    if (mapped) {
      event.preventDefault();
      emit(mapped);
      clearInputValue();
    }
  }

  function handlePaste(event) {
    if (disabled) {
      return;
    }

    const text = event.clipboardData?.getData("text/plain") || "";
    if (!text) {
      return;
    }

    event.preventDefault();
    handlePrintable(text);
    clearInputValue();
  }

  useImperativeHandle(
    ref,
    () => ({
      focus: focusInput,
      sendText: (text) => emit(text)
    }),
    [disabled]
  );

  useEffect(() => {
    focusInput();
  }, [focusToken, disabled]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        window.setTimeout(() => focusInput(), 50);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [disabled]);

  return (
    <>
      <button
        className="mobile-terminal-ios__focus-strip"
        onClick={focusInput}
        type="button"
      >
        <span>{status}</span>
        <span>{ctrlArmed ? "Ctrl" : "Tap to type"}</span>
      </button>
      <textarea
        aria-label="iPhone terminal input"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className="mobile-terminal-ios__hidden-input"
        onBeforeInput={handleBeforeInput}
        onBlur={() => window.setTimeout(() => focusInput(), 50)}
        onCompositionEnd={(event) => {
          composingRef.current = false;
          const text = event.data || event.currentTarget.value || "";
          handlePrintable(text);
          clearInputValue();
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionUpdate={() => {
          composingRef.current = true;
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        ref={textareaRef}
        rows={1}
        spellCheck={false}
      />
    </>
  );
});

export default TerminalInputControllerIOS;
