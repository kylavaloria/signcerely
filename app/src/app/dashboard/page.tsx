import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { PlusIcon, SignatureIcon } from "@/components/icons";
import { listDrafts, nextStepHref } from "@/lib/documents";
import { requireUser } from "@/lib/profile";
import { EmailNotice } from "./EmailNotice";

export const metadata: Metadata = { title: "Documents · It's Your Sign" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ email?: string; deleted?: string }> }) {
  const user = await requireUser();
  const { email: emailFlag, deleted } = await searchParams;
  const drafts = await listDrafts(user.wallet_address);
  const justSent = emailFlag === "sent" || emailFlag === "failed" ? emailFlag : null;
  const firstName = user.full_name.split(/\s+/)[0];

  return (
    <div style={{ minHeight: "100vh" }}>
      <SiteHeader current="documents" user={{ name: user.full_name, wallet: user.wallet_address }} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px", display: "flex", flexDirection: "column", gap: 32 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 className="h" style={{ fontSize: 40, fontWeight: 700 }}>
              Hi, {firstName}
            </h1>
            <p className="muted">Nothing is waiting for you right now.</p>
          </div>
          <Link className="btn btn-primary" href="/documents/new">
            <PlusIcon /> New document
          </Link>
        </div>

        {!user.email_verified_at && user.email && <EmailNotice email={user.email} justSent={justSent} />}
        {deleted && (
          <p className="note" role="status" style={{ background: "#fff", border: "1px solid var(--line)" }}>
            Draft deleted.
          </p>
        )}

        {drafts.length > 0 && (
          <section aria-labelledby="drafts-h" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 id="drafts-h" className="h" style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
              Drafts
              <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, background: "#fff", border: "1px solid var(--line)", borderRadius: 999, padding: "2px 10px" }}>
                {drafts.length}
              </span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))", gap: 16 }}>
              {drafts.map((d) => (
                <article key={d.id} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, boxShadow: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <h3 style={{ fontSize: 16 }}>{d.title}</h3>
                    <span style={{ flex: "none", height: 24, padding: "0 10px", borderRadius: 999, background: "var(--line-2)", color: "var(--ink-2)", fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>
                      Draft
                    </span>
                  </div>
                  <p className="help">
                    {d.page_count} {d.page_count === 1 ? "page" : "pages"} · {d.signer_count} {d.signer_count === 1 ? "signer" : "signers"} ·{" "}
                    {d.field_count} signature {d.field_count === 1 ? "box" : "boxes"}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line-2)", paddingTop: 12, marginTop: "auto" }}>
                    <span className="help">Edited {new Date(d.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <Link className="btn btn-secondary" style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }} href={nextStepHref(d)}>
                      Continue
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {drafts.length === 0 && (
        <section
          className="card"
          aria-labelledby="empty-title"
          style={{ padding: "56px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}
        >
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--yellow-tint)",
              display: "grid",
              placeItems: "center",
              color: "var(--navy)",
            }}
          >
            <SignatureIcon size={30} />
          </span>
          <h2 id="empty-title" className="h" style={{ fontSize: 26, fontWeight: 700 }}>
            No documents yet
          </h2>
          <p className="muted" style={{ maxWidth: 460 }}>
            Upload a PDF, choose who signs and in what order, and we’ll email each person when it’s their turn.
          </p>
          <Link className="btn btn-primary" href="/documents/new">
            <PlusIcon /> Upload a PDF
          </Link>
        </section>
        )}
      </main>
    </div>
  );
}
