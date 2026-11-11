import { Badge } from "./Decor";
import { SiteHeader } from "./SiteHeader";

/** Full-page message used by error, not-found and similar states. */
export function StatusPage({
  tone = "neutral",
  eyebrow,
  title,
  children,
  actions,
}: {
  tone?: "neutral" | "error";
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "clamp(40px, 10vh, 96px) 24px 80px" }}>
        <div className="card" style={{ padding: "clamp(24px, 6vw, 40px)", display: "flex", flexDirection: "column", gap: 16 }}>
          <Badge name={tone === "error" ? "magnifier" : "document"} size={84} pixel={4.5} tone={tone === "error" ? "yellow" : "blue"} />
          {eyebrow && (
            <p className="tag" style={{ color: tone === "error" ? "var(--red-ink)" : undefined }}>
              {eyebrow}
            </p>
          )}
          <h1 className="h" style={{ fontSize: "clamp(26px, 6vw, 34px)", fontWeight: 700, lineHeight: 1.15 }}>
            {title}
          </h1>
          {children && <div style={{ color: "var(--ink-2)", fontSize: 16.5, display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>}
          {actions && <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>{actions}</div>}
        </div>
      </main>
    </>
  );
}
