import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AlertIcon, CheckIcon, ExternalIcon } from "@/components/icons";
import { SIGNER_COLORS } from "@/lib/doc-rules";
import { requireUser } from "@/lib/profile";
import { chainConfigFromEnv } from "@/lib/stellar/contract";
import { db } from "@/lib/supabase";
import { CancelDocumentButton } from "./CancelDocumentButton";
import { SignerActions } from "./SignerActions";

export const metadata: Metadata = { title: "Document · Signcerely" };

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: "Waiting for signatures", bg: "#E8ECFA", fg: "#1F3FBF" },
  completed: { label: "Completed", bg: "#E3F5EC", fg: "#146B42" },
  declined: { label: "Declined", bg: "#FBE9E9", fg: "#A82E2E" },
  cancelled: { label: "Cancelled", bg: "#EEF1F7", fg: "#33406A" },
};
const SIGNER_STATUS: Record<string, string> = {
  waiting: "Waiting for their turn",
  invited: "Invited",
  viewed: "Opened the document",
  signed: "Signed",
  declined: "Declined",
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string; emailFailed?: string }>;
}) {
  const { id } = await params;
  const { sent, emailFailed } = await searchParams;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: doc } = await db()
    .from("documents")
    .select("id, title, summary, status, in_order, page_count, original_hash, chain_doc_id, create_tx_hash, sent_at, completed_at, sender_wallet")
    .eq("id", id)
    .eq("sender_wallet", user.wallet_address)
    .maybeSingle();
  if (!doc) notFound();
  if (doc.status === "draft") redirect(`/documents/${doc.id}/review`);

  const [{ data: signers }, { data: events }] = await Promise.all([
    db()
      .from("document_signers")
      .select("id, slot, invited_name, invited_email, status, signed_at, sign_tx_hash")
      .eq("document_id", doc.id)
      .order("slot"),
    db().from("document_events").select("kind, created_at, tx_hash, signer_id, detail").eq("document_id", doc.id).order("created_at"),
  ]);
  const signed = (signers ?? []).filter((s) => s.status === "signed").length;
  const total = signers?.length ?? 0;
  const st = STATUS[doc.status] ?? STATUS.pending;
  const testnet = chainConfigFromEnv().networkPassphrase.includes("Test");
  const expert = (path: string) => `https://stellar.expert/explorer/${testnet ? "testnet" : "public"}/${path}`;
  const nameOf = (sid: string | null) => signers?.find((s) => s.id === sid)?.invited_name ?? "";
  const EVENT: Record<string, string> = {
    created: "Recorded on Stellar",
    sent: "Sent for signing",
    invited: "Invited",
    viewed: "Opened the document",
    signed: "Signed",
    declined: "Declined",
    cancelled: "Cancelled",
    completed: "Completed",
    reminder_sent: "Reminder sent to",
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <SiteHeader current="documents" user={{ name: user.full_name, wallet: user.wallet_address }} />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Link href="/dashboard" style={{ fontWeight: 600, fontSize: 14.5 }}>
          ← All documents
        </Link>

        {sent && (
          <div className="note note-green" role="status">
            <CheckIcon color="#1F9D61" />
            <span>
              <strong>Sent.</strong> The document’s fingerprint is now recorded on Stellar, and{" "}
              {doc.in_order ? `${signers?.[0]?.invited_name ?? "the first signer"} has been invited` : "everyone has been invited"}.
            </span>
          </div>
        )}
        {emailFailed && (
          <p className="note note-red" role="alert">
            <AlertIcon />
            <span>
              We couldn’t email <strong>{emailFailed}</strong>. Use <strong>Copy invite link</strong> below and send it yourself (for example in
              chat). Without a verified domain, Resend’s test sender can only email your own address.
            </span>
          </p>
        )}

        <section className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14, boxShadow: "none" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <h1 className="h" style={{ fontSize: 30, fontWeight: 700, maxWidth: 680 }}>
              {doc.title}
            </h1>
            <span style={{ height: 28, padding: "0 12px", borderRadius: 999, background: st.bg, color: st.fg, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center" }}>
              {st.label}
            </span>
          </div>
          {doc.summary && <p style={{ color: "var(--ink-2)" }}>{doc.summary}</p>}
          {doc.status === "pending" && (
            <div>
              <CancelDocumentButton documentId={doc.id} wallet={user.wallet_address} signedCount={signed} />
            </div>
          )}
          {doc.status === "cancelled" && (
            <p className="note" role="status" style={{ background: "var(--line-2)" }}>
              <span>
                <strong>You cancelled this document</strong>, so it can’t be signed. To try again, send a revised version as a new document.
              </span>
            </p>
          )}
          {doc.status === "completed" && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="btn btn-primary" href={`/documents/${doc.id}/download`}>
                Download signed copy
              </a>
              <a className="btn btn-secondary" href={`/v/${doc.chain_doc_id}`}>
                Open verification page
              </a>
            </div>
          )}
          <p className="help">
            Sent {fmt(doc.sent_at)} · {doc.page_count} {doc.page_count === 1 ? "page" : "pages"} · {doc.in_order ? "one after another" : "all at once"}
          </p>
          <div aria-label={`${signed} of ${total} signed`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {(signers ?? []).map((s) => (
              <span key={s.id} style={{ flex: 1, height: 6, borderRadius: 3, background: s.status === "signed" ? "var(--green)" : "#DCE2F0" }} />
            ))}
            <span style={{ fontSize: 13.5, fontWeight: 600, marginLeft: 8, whiteSpace: "nowrap" }}>
              {signed} of {total} signed
            </span>
          </div>
        </section>

        <section className="card" aria-labelledby="sg" style={{ boxShadow: "none" }}>
          <h2 id="sg" style={{ fontSize: 16, padding: "20px 24px 4px" }}>
            Signers
          </h2>
          <ol style={{ listStyle: "none", padding: 0 }}>
            {(signers ?? []).map((s) => {
              const isMe = s.invited_email.toLowerCase() === user.email?.toLowerCase();
              const open = doc.status === "pending" && (s.status === "invited" || s.status === "viewed" || s.status === "waiting");
              const myTurn = !doc.in_order || (signers ?? []).every((o) => o.slot >= s.slot || o.status === "signed");
              return (
                <li key={s.id} style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", padding: "16px 24px", borderTop: "1px solid var(--line-2)" }}>
                  <span style={{ flex: "none", width: 36, height: 36, borderRadius: "50%", background: SIGNER_COLORS[s.slot % 5].solid, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14 }}>
                    {s.slot + 1}
                  </span>
                  <div style={{ flex: "1 1 240px" }}>
                    <p style={{ fontWeight: 600 }}>
                      {s.invited_name} {isMe && <span className="muted">(you)</span>}
                    </p>
                    <p className="help">
                      {s.invited_email} · {SIGNER_STATUS[s.status] ?? s.status}
                      {s.signed_at ? ` ${fmt(s.signed_at)}` : ""}
                    </p>
                  </div>
                  {s.sign_tx_hash && (
                    <a href={expert(`tx/${s.sign_tx_hash}`)} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 14, display: "inline-flex", gap: 6, alignItems: "center" }}>
                      View on Stellar Expert <ExternalIcon size={14} />
                    </a>
                  )}
                  {open && !isMe && <SignerActions signerId={s.id} canResend={s.status !== "waiting"} />}
                  {open && isMe && myTurn && (
                    <Link className="btn btn-sign" href={`/sign/${s.id}`} style={{ minHeight: 40 }}>
                      Sign now
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="card" aria-labelledby="act" style={{ padding: "20px 24px", boxShadow: "none", display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 id="act" style={{ fontSize: 16 }}>
            Activity
          </h2>
          <ol style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {(events ?? []).map((e, i) => (
              <li key={i} style={{ display: "flex", gap: 12, fontSize: 14.5 }}>
                <span className="help" style={{ minWidth: 170 }}>
                  {fmt(e.created_at)}
                </span>
                <span>
                  {EVENT[e.kind] ?? e.kind} {e.signer_id ? <strong>{nameOf(e.signer_id)}</strong> : null}
                  {(e.kind === "declined" || e.kind === "cancelled") && (e.detail as { reason?: string } | null)?.reason ? (
                    <span className="muted"> — “{(e.detail as { reason: string }).reason}”</span>
                  ) : null}
                  {e.tx_hash && (
                    <>
                      {" · "}
                      <a href={expert(`tx/${e.tx_hash}`)} target="_blank" rel="noopener noreferrer">
                        transaction
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <details className="card" style={{ padding: "4px 24px", boxShadow: "none" }}>
          <summary style={{ cursor: "pointer", minHeight: 52, display: "flex", alignItems: "center", fontWeight: 700 }}>Technical details</summary>
          <div style={{ paddingBottom: 20, display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
            <div>
              <p className="tag">Document fingerprint (SHA-256)</p>
              <p className="mono" style={{ wordBreak: "break-all" }}>{doc.original_hash}</p>
            </div>
            <div>
              <p className="tag">On-chain document id</p>
              <p className="mono" style={{ wordBreak: "break-all" }}>{doc.chain_doc_id}</p>
            </div>
            <div>
              <p className="tag">Contract</p>
              <a className="mono" style={{ wordBreak: "break-all" }} href={expert(`contract/${chainConfigFromEnv().contractId}`)} target="_blank" rel="noopener noreferrer">
                {chainConfigFromEnv().contractId}
              </a>
            </div>
          </div>
        </details>
      </main>
    </div>
  );
}
