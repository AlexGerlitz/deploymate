"use client";

const controls = [
  { label: "Ctrl", action: "ctrl" },
  { label: "Esc", input: "\u001b" },
  { label: "Tab", input: "\t" },
  { label: "Up", input: "\u001b[A" },
  { label: "Down", input: "\u001b[B" },
  { label: "Left", input: "\u001b[D" },
  { label: "Right", input: "\u001b[C" },
  { label: "PgUp", input: "\u001b[5~" },
  { label: "PgDn", input: "\u001b[6~" },
  { label: "|", input: "|" },
  { label: "/", input: "/" },
  { label: "-", input: "-" }
];

export default function MobileTerminalToolbar({
  ctrlArmed,
  onArmCtrl,
  onRestoreFocus,
  onSend
}) {
  return (
    <div className="mobile-terminal-ios__toolbar">
      {controls.map((control) => (
        <button
          className={`mobile-terminal-ios__tool${
            control.action === "ctrl" && ctrlArmed ? " is-active" : ""
          }`}
          key={control.label}
          onClick={() => {
            if (control.action === "ctrl") {
              onArmCtrl?.();
              return;
            }

            onSend?.(control.input);
            onRestoreFocus?.();
          }}
          type="button"
        >
          {control.label}
        </button>
      ))}
    </div>
  );
}
