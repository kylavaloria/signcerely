import { Chip, PageDecor, PixelArt } from "@/components/Decor";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AlertIcon, CheckIcon, SignatureIcon } from "@/components/icons";
import { DOCS_BUCKET } from "@/lib/documents";
import { formatSignedDate } from "@/lib/final-pdf";
import { getAccess } from "@/lib/invite-access";
import { getProfile } from "@/lib/profile";
import { maskEmail } from "@/lib/signer-identity";
import { db } from "@/lib/supabase";
import { markViewed } from "./actions";
import { InviteKeyCatcher } from "./InviteKeyCatcher";
import { SigningView, type ViewField, type ViewSigner } from "./SigningView";

export const metadata: Metadata = { title: "Review and sign · Signcerely" };

async function signedUrl(bucket: string, path: string, opts?: { download?: string }) {
  const { data } = await db().storage.from(bucket).createSignedUrl(path, 60 * 30, opts);
  return data?.signedUrl ?? null;
}

export default async function SignPage({ params }: { params: Promise<{ signerId: string }> }) {
  const { signerId } = await params;
  const a = await getAccess(signerId);
  if (!a) notFound();
  const profile = a.wallet ? await getProfile(a.wallet) : null;
  const header = <SiteHeader user={profile ? { name: profile.full_name, wallet: profile.wallet_address } : null} />;
  const sender = await getProfile(a.doc.sender_wallet);

  const senderName = sender?.full_name ?? "Someone";
  const signerIsSender =
    a.signer.wallet_address === a.doc.sender_wallet ||
    Boolean(sender?.email && a.signer.invited_email.toLowerCase() === sender.email.toLowerCase());
  const inviteLine =
    a.isSender && signerIsSender
      ? "You added yourself as a signer on this agreement."
      : a.isSender
        ? `You invited ${a.signer.invited_name} to sign this agreement.`
        : a.invited && !a.wrongAccount
          ? `${senderName} invited you to sign this agreement.`
          : `${senderName} invited ${a.signer.invited_name} to sign this agreement.`;

  const banner = (
    <div style={{ background: "var(--yellow-tint)", borderBottom: "1px solid #F0DE9C" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ flex: "none", width: 44, height: 44, borderRadius: 12, background: "var(--yellow)", display: "grid", placeItems: "center" }}>
          <SignatureIcon />
        </span>
        <p style={{ fontSize: 17 }}>
          <strong className="h" style={{ fontSize: 21, fontWeight: 700 }}>
            Your turn to sign.
          </strong>{" "}
          {inviteLine}
        </p>
        <span className="decor-inline decor-float" style={{ marginLeft: "auto", display: "inline-flex", ["--tilt" as string]: "-8deg" }}>
          <PixelArt name="pen" pixel={4} />
        </span>
        <span className="decor-inline" style={{ display: "inline-flex", flex: "none" }}>
          <Chip tone="blue">{"{ sign here }"}</Chip>
        </span>
      </div>
    </div>
  );

  // Not unlocked yet: show only who invited whom, and try the link's key.
  if (!a.invited && !a.isSender) {
    return (
      <div style={{ minHeight: "100vh" }}>
        {header}
        {banner}
        <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px", display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 className="h" style={{ fontSize: 30, fontWeight: 700 }}>
            {a.doc.title}
          </h1>
          <InviteKeyCatcher signerId={signerId} locked />
          {!a.wallet && (
            <p className="help">
              Already have an account? <Link href={`/sign-in?next=/sign/${signerId}`}>Sign in</Link>
            </p>
          )}
        </main>
      </div>
    );
  }

  if (a.invited && a.signer.status === "invited") await markViewed(signerId);

  const [{ data: signers }, { data: fields }] = await Promise.all([
    db()
      .from("document_signers")
      .select("id, slot, invited_name, wallet_address, status, signed_at, signature_image_path")
      .eq("document_id", a.doc.id)
      .order("slot"),
    db().from("signature_fields").select("id, signer_id, page, x, y, width, height").eq("document_id", a.doc.id),
  ]);
  const wallets = (signers ?? []).map((s) => s.wallet_address).filter(Boolean) as string[];
  const { data: names } = wallets.length
    ? await db().from("profiles").select("wallet_address, full_name").in("wallet_address", wallets)
    : { data: [] };
  const viewSigners: ViewSigner[] = await Promise.all(
    (signers ?? []).map(async (s) => ({
      id: s.id,
      slot: s.slot,
      name: names?.find((n) => n.wallet_address === s.wallet_address)?.full_name ?? s.invited_name,
      status: s.status,
      signedLabel: s.signed_at ? `Signed ${formatSignedDate(new Date(s.signed_at))}` : null,
      imageUrl: s.status === "signed" && s.signature_image_path ? await signedUrl("signatures", s.signature_image_path) : null,
    })),
  );
  const viewFields: ViewField[] = (fields ?? []).map((f) => ({
    id: f.id,
    signerId: f.signer_id,
    page: f.page,
    x: Number(f.x),
    y: Number(f.y),
    width: Number(f.width),
    height: Number(f.height),
  }));

  const completed = a.doc.status === "completed";
  const iSigned = a.signer.status === "signed";
  const earlierPending = a.doc.in_order && (signers ?? []).some((s) => s.slot < a.signer.slot && s.status !== "signed");
  const blockedReason = a.wrongAccount
    ? `This invite is for ${a.signer.invited_name}, so you can’t sign it as ${profile?.full_name ?? "this account"}. If you’re ${a.signer.invited_name}, sign out and sign in with the account that uses ${maskEmail(a.signer.invited_email)}.`
    : !a.invited
    ? "You’re viewing this as the sender. Each person signs from their own invite."
    : a.doc.status !== "pending"
      ? "This document is no longer waiting for signatures."
      : earlierPending
        ? "It isn’t your turn yet. We’ll email you when the people before you have signed."
        : null;

  const pdfUrl = (await signedUrl(DOCS_BUCKET, completed && a.doc.final_file_path ? a.doc.final_file_path : a.doc.file_path))!;
  const saved = profile?.signature_path ? await signedUrl("signatures", profile.signature_path) : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <InviteKeyCatcher signerId={signerId} locked={false} />
      {header}
      {!completed && !iSigned && banner}
      <PageDecor content={1320} left="pen" right="check" />
      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 24px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 className="h" style={{ fontSize: 28, fontWeight: 700 }}>
              {a.doc.title}
            </h1>
            <p className="help">
              Sent by {sender?.full_name ?? "someone"} · {a.doc.page_count} {a.doc.page_count === 1 ? "page" : "pages"}
            </p>
            {a.doc.summary && <p style={{ color: "var(--ink-2)", maxWidth: 720 }}>{a.doc.summary}</p>}
          </div>
          {completed && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="btn btn-primary" href={`/sign/${signerId}/download`}>
                Download signed copy
              </a>
              <a className="btn btn-secondary" href={`/v/${a.doc.chain_doc_id}`}>
                Verification page
              </a>
            </div>
          )}
        </div>

        {completed && (
          <p className="note note-green" role="status">
            <CheckIcon color="#1F9D61" />
            <span>
              <strong>Everyone has signed.</strong> This is the final signed copy, with each signature recorded on Stellar.
            </span>
          </p>
        )}
        {a.doc.status === "cancelled" && (
          <p className="note" role="status" style={{ background: "var(--line-2)" }}>
            <span>
              <strong>{sender?.full_name ?? "The sender"} cancelled this document</strong>, so it no longer needs your signature.
            </span>
          </p>
        )}
        {a.doc.status === "declined" && (
          <p className="note note-red" role="status">
            <AlertIcon />
            <span>
              <strong>This document was declined</strong>, so it can’t be signed. The sender can send a revised version as a new document.
            </span>
          </p>
        )}
        {!completed && iSigned && (
          <p className="note note-green" role="status">
            <CheckIcon color="#1F9D61" />
            <span>
              <strong>You signed this document.</strong> We’ll email you the signed copy when everyone is done.
            </span>
          </p>
        )}

        {!a.wallet && !completed && !iSigned ? (
          <section className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14, maxWidth: 560, boxShadow: "none" }}>
            <h2 className="h" style={{ fontSize: 24, fontWeight: 700 }}>
              Sign in to sign
            </h2>
            <p className="muted">
              Your Varial wallet is your signature. Connect it, then you’ll come right back here. New to Varial? We’ll walk you through it.
            </p>
            <Link className="btn btn-primary btn-lg" href={`/sign-in?next=/sign/${signerId}`}>
              Continue with Varial
            </Link>
          </section>
        ) : (
          <SigningView
            signerId={signerId}
            wallet={a.wallet}
            canSign={a.canSign && !iSigned && !completed}
            blockedReason={iSigned || completed ? "Nothing left for you to do here." : blockedReason}
            pdfUrl={pdfUrl}
            pageCount={a.doc.page_count}
            fields={completed ? [] : viewFields}
            signers={viewSigners}
            myName={profile?.full_name ?? a.signer.invited_name}
            today={formatSignedDate(new Date())}
            savedSignatureUrl={saved}
            canDecline={a.canSign && a.invited && a.doc.status === "pending" && !iSigned}
            senderName={sender?.full_name ?? "The sender"}
          />
        )}
      </main>
    </div>
  );
}
