import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NewDocShell } from "@/components/NewDocShell";
import { AlertIcon, ShieldIcon } from "@/components/icons";
import { SIGNER_COLORS } from "@/lib/doc-rules";
import { getDraftFields, getDraftSigners, getOwnedDraft, signedPdfUrl } from "@/lib/documents";
import { requireUser } from "@/lib/profile";
import { DeleteDraftButton } from "./DeleteDraftButton";
import { ReviewPreview } from "./ReviewPreview";
import { SendButton } from "./SendButton";

export const metadata: Metadata = { title: "Review · New document · Signcerely" };

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
  const [signers, fields, pdfUrl] = await Promise.all([getDraftSigners(doc.id), getDraftFields(doc.id), signedPdfUrl(doc.file_path!)]);
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

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="card" style={{ boxShadow: "none" }}>
          <div style={{ ...row, borderTop: 0 }}>
            <div style={{ flex: 1 }}>
              <p style={k}>Document</p>
              <dl className="detail-rows">
                <div>
                  <dt>Title</dt>
                  <dd>{doc.title}</dd>
                </div>
                <div>
                  <dt>Pages</dt>
                  <dd>{doc.page_count ?? "—"}</dd>
                </div>
                <div>
                  <dt>Description</dt>
                  <dd>{doc.summary || "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div style={row}>
            <div style={{ flex: 1 }}>
              <p style={k}>Signers</p>
              <dl className="detail-rows" style={{ marginBottom: 14 }}>
                <div>
                  <dt>Signing order</dt>
                  <dd>{doc.in_order ? "One after another" : "All at once"}</dd>
                </div>
              </dl>
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
            <div style={{ flex: 1 }}>
              <p style={k}>Signature spots</p>
              {fields.length === 0 ? (
                <p style={{ color: "var(--ink-2)" }}>None placed. Signatures will go on the summary page of the signed copy.</p>
              ) : (
                <dl className="detail-rows">
                  <div>
                    <dt>Boxes</dt>
                    <dd>{fields.length}</dd>
                  </div>
                  <div>
                    <dt>{pages.length === 1 ? "Page" : "Pages"}</dt>
                    <dd>{pages.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>Added under each signature automatically</dd>
                  </div>
                </dl>
              )}
            </div>
            <Link style={edit} href={`/documents/${doc.id}/spots`} aria-label="Edit signature spots">
              Edit
            </Link>
          </div>
        </div>

        <ReviewPreview
          pdfUrl={pdfUrl}
          pageCount={doc.page_count ?? 1}
          signers={signers.map((s) => ({ id: s.id, slot: s.slot, name: s.invited_name }))}
          fields={fields.map((f) => ({ signerId: f.signer_id, page: f.page, x: f.x, y: f.y, width: f.width, height: f.height }))}
        />

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
          <ShieldIcon size={24} color="#1F6FD6" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontWeight: 700 }}>What happens when you send</p>
            <p style={{ fontSize: 15, color: "var(--ink-2)" }}>
              We save a fingerprint of the file permanently, so no one can swap it later. Your wallet will ask you to approve once, and a
              small network fee applies. Then each signer gets their invitation.
            </p>
          </div>
        </div>

        <div id="send-error-slot" />
      </div>

      <div className="wizard-footer">
        <div className="wizard-footer-group">
          <Link className="btn btn-ghost" href={`/documents/${doc.id}/spots`}>
            Back
          </Link>
          <DeleteDraftButton documentId={doc.id} />
        </div>
        <div className="wizard-footer-group">
          <Link className="btn btn-secondary" href="/dashboard">
            Save draft
          </Link>
          <SendButton
            documentId={doc.id}
            wallet={user.wallet_address}
            blocked={missing.length > 0 ? "Every signer needs a signature box first." : undefined}
          />
        </div>
      </div>
    </NewDocShell>
  );
}
