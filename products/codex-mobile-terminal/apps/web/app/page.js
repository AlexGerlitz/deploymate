import Link from "next/link";

const milestones = [
  "Web auth screen",
  "Reconnectable terminal session",
  "Mobile toolbar for Esc, Tab, Ctrl, arrows, paste",
  "Open Codex action",
  "Persistent server-side Codex state"
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Web Terminal</p>
        <h1>iPhone-first remote terminal for Codex</h1>
        <p className="lede">
          This sidecar project provides a purpose-built mobile terminal for
          Safari instead of a generic tty surface.
        </p>
        <div className="hero-actions">
          <Link className="action-button primary" href="/terminal">
            Open Terminal
          </Link>
          <Link className="action-button secondary" href="/console">
            Open Console
          </Link>
        </div>
        <div className="status-row">
          <span className="status-pill">Live on lab.deploymatecloud.ru</span>
          <span className="status-pill muted">Console-first flow is now the target</span>
        </div>
      </section>

      <section className="content-grid">
        <article className="info-card">
          <h2>Scope</h2>
          <ul>
            <li>Readable Codex-first console</li>
            <li>DOM output with normal iPhone text selection</li>
            <li>Persistent state on the server</li>
            <li>Raw terminal kept as advanced mode</li>
          </ul>
        </article>

        <article className="info-card">
          <h2>First Milestone</h2>
          <ol>
            {milestones.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>
      </section>
    </main>
  );
}
