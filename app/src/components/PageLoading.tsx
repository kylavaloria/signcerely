import { SiteHeader } from "./SiteHeader";
import { Spinner } from "./icons";

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <>
      <SiteHeader />
      <main style={{ minHeight: "50vh", display: "grid", placeItems: "center", padding: 24 }}>
        <p role="status" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--ink-2)", fontWeight: 600 }}>
          <Spinner size={24} /> {label}
        </p>
      </main>
    </>
  );
}
