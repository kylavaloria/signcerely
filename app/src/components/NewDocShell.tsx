import Link from "next/link";
import { CheckIcon, Logo } from "./icons";

const STEPS = ["Upload", "Signers", "Signature spots", "Review"] as const;

/** Header + progress for the New document wizard. `step` is 1-based. */
export function NewDocShell({
  step,
  children,
}: {
  step: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" aria-label="Signcerely home" className="brand">
            <Logo size={32} />
          </Link>
          <span className="beta hide-xs">Beta</span>
          <h1 className="h" style={{ fontSize: "clamp(17px, 4.6vw, 20px)", fontWeight: 700, flex: 1, whiteSpace: "nowrap" }}>
            New document
          </h1>
          <Link className="btn btn-ghost" href="/dashboard" style={{ minHeight: 44, padding: "0 14px" }}>
            Exit
          </Link>
        </div>
      </header>
      <main className="newdoc-main" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 28 }}>
        <nav aria-label="Progress" className="stepper">
          <ol style={{ listStyle: "none", padding: 0, display: "flex", alignItems: "center", gap: 12, maxWidth: 780 }}>
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <li key={label} style={{ display: "contents" }}>
                  {i > 0 && (
                    <span aria-hidden="true" style={{ flex: 1, minWidth: 16, height: 2, background: done || current ? "var(--green)" : "#DCE2F0" }} />
                  )}
                  <span
                    aria-current={current ? "step" : undefined}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: current ? "var(--navy)" : "var(--ink-3)" }}
                  >
                    <b
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 14,
                        border: "1.5px solid",
                        borderColor: current ? "var(--blue)" : done ? "var(--green-tint)" : "#C7D0EC",
                        background: current ? "var(--blue)" : done ? "var(--green-tint)" : "#fff",
                        color: current ? "#fff" : done ? "var(--green-ink)" : "var(--ink-3)",
                      }}
                    >
                      {done ? <CheckIcon size={15} strokeWidth={3} /> : n}
                    </b>
                    <span className="step-label">{label}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
        {children}
      </main>
    </div>
  );
}
