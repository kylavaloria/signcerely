import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewDocShell } from "@/components/NewDocShell";
import { AlertIcon, InfoIcon, ShieldIcon } from "@/components/icons";
import { SIGNER_COLORS } from "@/lib/doc-rules";
import { getDraftFields, getDraftSigners, getOwnedDraft } from "@/lib/documents";
import { requireUser } from "@/lib/profile";
import { DeleteDraftButton } from "./DeleteDraftButton";

export const metadata: Metadata = { title: "Review · New document · It's Your Sign" };

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  padding: "20px 24px",
  borderTop: "1px solid var(--line-2)",
};
const k: React.CSSProperties = { fontSize: 13, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 6 };
const edit: React.CSSProperties = { fontSize: 14.5, fontWeight: 600, minHeight: 44, display: "flex", alignItems: "center" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await getOwnedDraft(id, user.wallet_address);
  const [signers, fields] = await Promise.all([getDraftSigners(doc.id), getDraftFields(doc.id)]);
  if (signers.length < 2) redirect(`/documents/${doc.id}/signers`);

  const myEmail = user.email?.toLowerCase();
  const boxCount = (sid: string) => fields.filter((f) => f.signer_id === sid).length;
  const pages = [...new Set(fields.map((f) => f.page))].sort((a, b) => a - b);
  const missing = fields.length > 0 ? signers.filter((s) => boxCount(s.id) === 0) : [];

  return (
    <NewDocShell step={4}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 className="h" style={{ fontSize: 32, fontWeight: 700 }}>
          Check everything, then send
        </h2>
        <p className="muted" style={{ fontSize: 17 }}>
          Once it’s sent, the file is locked so everyone signs the same version.
        </p>
      </div>

      <div style={{ maxWidth: 860, display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="card" style={{ boxShadow: "none" }}>
          <div style={{ ...row, borderTop: 0 }}>
            <div>
              <p style={k}>Document</p>
              <p style={{ fontWeight: 700, fontSize: 17 }}>{doc.title}</p>
              <p className="help">
                {doc.page_count} {doc.page_count === 1 ? "page" : "pages"}
              </p>
            </div>
          </div>
          {doc.summary && (
            <div style={row}>
              <div>
                <p style={k}>What signers are agreeing to</p>
                <p style={{ color: "var(--ink-2)", maxWidth: 620 }}>{doc.summary}</p>
              </div>
            </div>
          )}
          <div style={row}>
            <div style={{ flex: 1 }}>
              <p style={k}>Signers · {doc.in_order ? "one after another" : "all at once"}</p>
              <ol style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12, marginTop: 6 }}>
                {signers.map((s) => (
                  <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 28, height: 28, borderRadius: "50%", background: SIGNER_COLORS[s.slot % 5].solid, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13 }}>
                      {s.slot + 1}
                    </span>
                    <p>
                      <strong>{s.invited_name}</strong>{" "}
                      <span className="muted">
                        {s.invited_email.toLowerCase() === myEmail ? "(you) · " : "· "}
                        {s.invited_email}
                      </span>
                    </p>
                  </li>
                ))}
              </ol>
            </div>
            <Link style={edit} href={`/documents/${doc.id}/signers`} aria-label="Edit signers">
              Edit
            </Link>
          </div>
          <div style={row}>
            <div>
              <p style={k}>Signature spots</p>
              <p style={{ color: "var(--ink-2)" }}>
                {fields.length === 0
                  ? "None placed — signatures will go on the summary page of the signed copy."
                  : `${fields.length} ${fields.length === 1 ? "box" : "boxes"} on page ${pages.join(", ")}. The date is added under each signature automatically.`}
              </p>
            </div>
            <Link style={edit} href={`/documents/${doc.id}/spots`} aria-label="Edit signature spots">
              Edit
            </Link>
          </div>
        </div>

        {missing.length > 0 && (
          <p className="note note-red" role="alert">
            <AlertIcon />
            <span>
              <strong>{missing.map((s) => s.invited_name).join(", ")}</strong> {missing.length === 1 ? "doesn’t" : "don’t"} have a signature
              box yet. <Link href={`/documents/${doc.id}/spots`}>Add one</Link>.
            </span>
          </p>
        )}

        <div style={{ background: "var(--blue-tint)", borderRadius: 14, padding: "20px 24px", display: "flex", gap: 16 }}>
          <ShieldIcon size={24} color="#1F3FBF" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontWeight: 700 }}>What happens when you send</p>
            <p style={{ fontSize: 15, color: "var(--ink-2)" }}>
              We save a fingerprint of the file permanently, so no one can swap it later. Your wallet will ask you to approve once, and a
              small network fee applies. Then each signer gets their invitation.
            </p>
          </div>
        </div>

        <p className="note" style={{ background: "#fff", border: "1px solid var(--line)" }}>
          <InfoIcon />
          <span>Sending is coming in the next build. Your draft is saved — you can come back to it from your dashboard.</span>
        </p>
      </div>

      <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid var(--line)", margin: "0 -24px", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn btn-ghost" href={`/documents/${doc.id}/spots`}>
            Back
          </Link>
          <DeleteDraftButton documentId={doc.id} />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Link className="btn btn-secondary" href="/dashboard">
            Save draft
          </Link>
          <button type="button" className="btn btn-primary" disabled title="Sending is coming in the next build">
            Send for signing
          </button>
        </div>
      </div>
    </NewDocShell>
  );
}
