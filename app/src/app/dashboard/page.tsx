import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ArrowRight, PlusIcon, SignatureIcon } from "@/components/icons";
import { listDrafts, listSent, listToSign, nextStepHref, type SentDoc } from "@/lib/documents";
import { requireUser } from "@/lib/profile";
import { EmailNotice } from "./EmailNotice";

export const metadata: Metadata = { title: "Documents · Signcerely" };

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

function Section({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 id={id} className="h" style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
        {title}
        <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, background: "#fff", border: "1px solid var(--line)", borderRadius: 999, padding: "2px 10px" }}>
          {count}
        </span>
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))", gap: 16 }}>{children}</div>
    </section>
  );
}

function Progress({ doc }: { doc: SentDoc }) {
  const signed = doc.signers.filter((s) => s.status === "signed").length;
  return (
    <div aria-label={`${signed} of ${doc.signers.length} signed`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {doc.signers.map((s, i) => (
        <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: s.status === "signed" ? "var(--green)" : "#DCE2F0" }} />
      ))}
      <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 6, whiteSpace: "nowrap" }}>
        {signed} of {doc.signers.length} signed
      </span>
    </div>
  );
}

const cardStyle: React.CSSProperties = { padding: 20, display: "flex", flexDirection: "column", gap: 12, boxShadow: "none" };
const pill = (bg: string, fg: string): React.CSSProperties => ({
  flex: "none",
  height: 24,
  padding: "0 10px",
  borderRadius: 999,
  background: bg,
  color: fg,
  fontSize: 12.5,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
});

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ email?: string; deleted?: string }> }) {
  const user = await requireUser();
  const { email: emailFlag, deleted } = await searchParams;
  const verifiedEmail = user.email_verified_at ? user.email : null;
  const [drafts, sent, toSign] = await Promise.all([
    listDrafts(user.wallet_address),
    listSent(user.wallet_address),
    listToSign(user.wallet_address, verifiedEmail),
  ]);
  const waiting = sent.filter((d) => d.status === "pending");
  const closed = sent.filter((d) => d.status !== "pending");
  const justSent = emailFlag === "sent" || emailFlag === "failed" ? emailFlag : null;
  const firstName = user.full_name.split(/\s+/)[0];
  const empty = drafts.length + sent.length + toSign.length === 0;

  return (
    <div style={{ minHeight: "100vh" }}>
      <SiteHeader current="documents" user={{ name: user.full_name, wallet: user.wallet_address }} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px", display: "flex", flexDirection: "column", gap: 32 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 className="h" style={{ fontSize: 40, fontWeight: 700 }}>
              Hi, {firstName}
            </h1>
            <p className="muted">
              {toSign.length === 0
                ? "Nothing is waiting for your signature right now."
                : `${toSign.length} ${toSign.length === 1 ? "document is" : "documents are"} waiting for your signature.`}
            </p>
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

        {toSign.length > 0 && (
          <Section id="ts" title="Waiting for your signature" count={toSign.length}>
            {toSign.map((t) => (
              <article key={t.signerId} className="card" style={{ ...cardStyle, background: "var(--yellow-tint)", borderColor: "#F3DF95" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <h3 style={{ fontSize: 16 }}>{t.title}</h3>
                  <span style={pill("var(--yellow)", "var(--navy)")}>Your sign</span>
                </div>
                <p className="help">From {t.senderName}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #F3DF95", paddingTop: 12, marginTop: "auto" }}>
                  <span className="help">Sent {day(t.invitedAt)}</span>
                  <Link className="btn btn-sign" style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }} href={`/sign/${t.signerId}`}>
                    Review and sign <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </Section>
        )}

        {waiting.length > 0 && (
          <Section id="wo" title="Waiting for others" count={waiting.length}>
            {waiting.map((d) => (
              <article key={d.id} className="card" style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <h3 style={{ fontSize: 16 }}>
                    <Link href={`/documents/${d.id}`} style={{ color: "var(--navy)", textDecoration: "none" }}>
                      {d.title}
                    </Link>
                  </h3>
                  <span style={pill("var(--blue-tint)", "var(--blue)")}>Waiting</span>
                </div>
                <p className="help">{d.signers.map((s) => s.invited_name).join(", ")}</p>
                <Progress doc={d} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line-2)", paddingTop: 12, marginTop: "auto" }}>
                  <span className="help">Sent {day(d.sent_at)}</span>
                  <Link className="btn btn-secondary" style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }} href={`/documents/${d.id}`}>
                    View
                  </Link>
                </div>
              </article>
            ))}
          </Section>
        )}

        {drafts.length > 0 && (
          <Section id="dr" title="Drafts" count={drafts.length}>
            {drafts.map((d) => (
              <article key={d.id} className="card" style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <h3 style={{ fontSize: 16 }}>{d.title}</h3>
                  <span style={pill("var(--line-2)", "var(--ink-2)")}>Draft</span>
                </div>
                <p className="help">
                  {d.page_count} {d.page_count === 1 ? "page" : "pages"} · {d.signer_count} {d.signer_count === 1 ? "signer" : "signers"} ·{" "}
                  {d.field_count} signature {d.field_count === 1 ? "box" : "boxes"}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line-2)", paddingTop: 12, marginTop: "auto" }}>
                  <span className="help">Edited {day(d.updated_at)}</span>
                  <Link className="btn btn-secondary" style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }} href={nextStepHref(d)}>
                    Continue
                  </Link>
                </div>
              </article>
            ))}
          </Section>
        )}

        {closed.length > 0 && (
          <Section id="cl" title="Completed and closed" count={closed.length}>
            {closed.map((d) => (
              <article key={d.id} className="card" style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <h3 style={{ fontSize: 16 }}>{d.title}</h3>
                  <span
                    style={
                      d.status === "completed"
                        ? pill("var(--green-tint)", "var(--green-ink)")
                        : d.status === "declined"
                          ? pill("#FBE9E9", "#A82E2E")
                          : pill("var(--line-2)", "var(--ink-2)")
                    }
                  >
                    {d.status === "completed" ? "Completed" : d.status === "declined" ? "Declined" : "Cancelled"}
                  </span>
                </div>
                <Progress doc={d} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--line-2)", paddingTop: 12, marginTop: "auto" }}>
                  <span className="help">{d.completed_at ? `Completed ${day(d.completed_at)}` : `Sent ${day(d.sent_at)}`}</span>
                  <Link className="btn btn-secondary" style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }} href={`/documents/${d.id}`}>
                    View
                  </Link>
                </div>
              </article>
            ))}
          </Section>
        )}

        {empty && (
          <section
            className="card"
            aria-labelledby="empty-title"
            style={{ padding: "56px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}
          >
            <span style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--yellow-tint)", display: "grid", placeItems: "center", color: "var(--navy)" }}>
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
