import "server-only";
import { appUrl, escapeHtml, layout, sendEmail, type SendResult } from "./email";
import { decryptSecret } from "./invite-keys";
import { db } from "./supabase";

/**
 * Invite links carry the slot's invite secret in the URL fragment (#k=...),
 * which browsers never send to servers, so it doesn't end up in logs.
 */
export async function inviteLink(signerId: string, inviteSecretEnc: string): Promise<string> {
  return `${await appUrl()}/sign/${signerId}#k=${decryptSecret(inviteSecretEnc)}`;
}

type InviteInput = {
  signer: { id: string; invited_name: string; invited_email: string; invite_secret_enc: string };
  doc: { title: string; summary: string | null };
  senderName: string;
  kind: "invite" | "reminder" | "your-turn";
};

export async function sendInviteEmail(i: InviteInput): Promise<SendResult> {
  const link = await inviteLink(i.signer.id, i.signer.invite_secret_enc);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[invite] ${i.signer.invited_email} → ${link}`);
  }
  const first = i.signer.invited_name.split(/\s+/)[0];
  const lead =
    i.kind === "your-turn"
      ? `It’s your turn to sign <strong>${escapeHtml(i.doc.title)}</strong>.`
      : i.kind === "reminder"
        ? `A reminder: ${escapeHtml(i.senderName)} is waiting for your signature on <strong>${escapeHtml(i.doc.title)}</strong>.`
        : `${escapeHtml(i.senderName)} invited you to sign <strong>${escapeHtml(i.doc.title)}</strong>.`;
  const summary = i.doc.summary ? `<br><br><em>${escapeHtml(i.doc.summary)}</em>` : "";

  const res = await sendEmail({
    to: i.signer.invited_email,
    subject:
      i.kind === "your-turn"
        ? `It’s your sign: ${i.doc.title}`
        : i.kind === "reminder"
          ? `Reminder: please sign ${i.doc.title}`
          : `${i.senderName} invited you to sign ${i.doc.title}`,
    text: `Hi ${first},\n\n${lead.replace(/<[^>]+>/g, "")}\n${i.doc.summary ? `\n${i.doc.summary}\n` : ""}\nReview and sign: ${link}\n\nThis link is just for you — please don't forward it.`,
    html: layout({
      heading: i.kind === "your-turn" ? "It’s your sign." : "You’re invited to sign",
      body: `Hi ${escapeHtml(first)}, ${lead}${summary}`,
      button: { label: "Review and sign", url: link },
      footer: "This link is just for you — please don’t forward it. You’ll need a free Varial wallet to sign.",
    }),
  });
  return res;
}

/** Mark signers invited and email them. Returns who couldn't be emailed. */
export async function inviteSigners(
  documentId: string,
  slots: number[],
  opts: { senderName: string; senderWallet: string; senderEmail: string | null; kind?: "invite" | "your-turn" },
): Promise<{ failed: string[] }> {
  const [{ data: doc }, { data: signers }] = await Promise.all([
    db().from("documents").select("title, summary").eq("id", documentId).single(),
    db()
      .from("document_signers")
      .select("id, slot, invited_name, invited_email, invite_secret_enc, status")
      .eq("document_id", documentId)
      .in("slot", slots),
  ]);
  const failed: string[] = [];
  for (const s of signers ?? []) {
    if (s.status === "signed" || s.status === "declined") continue;
    await db()
      .from("document_signers")
      .update({ status: "invited", invited_at: new Date().toISOString() })
      .eq("id", s.id);
    await db().from("document_events").insert({ document_id: documentId, kind: "invited", signer_id: s.id });
    // The sender signing their own document doesn't need an email.
    if (opts.senderEmail && s.invited_email.toLowerCase() === opts.senderEmail.toLowerCase()) continue;
    const r = await sendInviteEmail({ signer: s, doc: doc!, senderName: opts.senderName, kind: opts.kind ?? "invite" });
    if (!r.ok) failed.push(s.invited_name);
  }
  return { failed };
}

/** Tell everyone the document is complete, with a link to their copy. */
export async function sendCompletedEmails(documentId: string): Promise<void> {
  const [{ data: doc }, { data: signers }] = await Promise.all([
    db().from("documents").select("id, title, sender_wallet, profiles(full_name, email)").eq("id", documentId).single(),
    db().from("document_signers").select("id, invited_name, invited_email").eq("document_id", documentId).order("slot"),
  ]);
  if (!doc || !signers) return;
  const base = await appUrl();
  const sender = doc.profiles as unknown as { full_name: string; email: string | null } | null;
  const names = signers.map((s) => s.invited_name).join(", ");
  const recipients = new Map<string, { name: string; url: string }>();
  for (const s of signers) recipients.set(s.invited_email.toLowerCase(), { name: s.invited_name, url: `${base}/sign/${s.id}` });
  if (sender?.email && !recipients.has(sender.email.toLowerCase())) {
    recipients.set(sender.email.toLowerCase(), { name: sender.full_name, url: `${base}/documents/${doc.id}` });
  }
  for (const [email, r] of recipients) {
    const first = r.name.split(/\s+/)[0];
    const res = await sendEmail({
      to: email,
      subject: `Signed by everyone: ${doc.title}`,
      text: `Hi ${first},\n\nEveryone has signed "${doc.title}" (${names}).\n\nDownload the signed copy: ${r.url}\n\nAnyone can check it at ${base}/verify.`,
      html: layout({
        heading: "Everyone has signed",
        body: `Hi ${escapeHtml(first)}, <strong>${escapeHtml(doc.title)}</strong> is complete. Signed by ${escapeHtml(names)}.`,
        button: { label: "Download the signed copy", url: r.url },
        footer: `Anyone can check the signed copy at ${escapeHtml(base)}/verify — no account needed.`,
      }),
    });
    if (!res.ok) console.warn(`[email] completed notice to ${email} not sent: ${res.reason}`);
  }
}

/** Tell the sender someone declined, with their reason if they gave one. */
export async function sendDeclinedEmail(documentId: string, declinerName: string, reason: string): Promise<void> {
  const { data: doc } = await db()
    .from("documents")
    .select("id, title, profiles(full_name, email)")
    .eq("id", documentId)
    .single();
  const sender = doc?.profiles as unknown as { full_name: string; email: string | null } | null;
  if (!doc || !sender?.email) return;
  const url = `${await appUrl()}/documents/${doc.id}`;
  const first = sender.full_name.split(/\s+/)[0];
  const why = reason ? `\n\nTheir reason: “${reason}”` : "";
  const res = await sendEmail({
    to: sender.email,
    subject: `${declinerName} declined to sign ${doc.title}`,
    text: `Hi ${first},\n\n${declinerName} declined to sign "${doc.title}". The document has stopped, so no one else can sign it.${why}\n\nDetails: ${url}\n\nTo try again, upload a revised version and send it as a new document.`,
    html: layout({
      heading: `${declinerName} declined to sign`,
      body: `Hi ${escapeHtml(first)}, ${escapeHtml(declinerName)} declined to sign <strong>${escapeHtml(doc.title)}</strong>. The document has stopped, so no one else can sign it.${
        reason ? `<br><br>Their reason: <em>“${escapeHtml(reason)}”</em>` : ""
      }<br><br>To try again, upload a revised version and send it as a new document.`,
      button: { label: "View the document", url },
      footer: "The decline is recorded on Stellar along with the other steps.",
    }),
  });
  if (!res.ok) console.warn(`[email] declined notice not sent: ${res.reason}`);
}

/** Tell everyone who was already invited that the sender cancelled the document. */
export async function sendCancelledEmails(documentId: string, reason: string): Promise<void> {
  const [{ data: doc }, { data: signers }] = await Promise.all([
    db().from("documents").select("id, title, profiles(full_name, email)").eq("id", documentId).single(),
    db()
      .from("document_signers")
      .select("id, invited_name, invited_email, status")
      .eq("document_id", documentId)
      .in("status", ["invited", "viewed", "signed"]),
  ]);
  const sender = doc?.profiles as unknown as { full_name: string; email: string | null } | null;
  if (!doc || !signers) return;
  const base = await appUrl();
  for (const s of signers) {
    if (sender?.email && s.invited_email.toLowerCase() === sender.email.toLowerCase()) continue;
    const first = s.invited_name.split(/\s+/)[0];
    const who = sender?.full_name ?? "The sender";
    const res = await sendEmail({
      to: s.invited_email,
      subject: `${who} cancelled ${doc.title}`,
      text: `Hi ${first},\n\n${who} cancelled "${doc.title}", so it no longer needs your signature.${reason ? `\n\nTheir note: “${reason}”` : ""}\n\nDetails: ${base}/sign/${s.id}`,
      html: layout({
        heading: "This document was cancelled",
        body: `Hi ${escapeHtml(first)}, ${escapeHtml(who)} cancelled <strong>${escapeHtml(doc.title)}</strong>, so it no longer needs your signature.${
          reason ? `<br><br>Their note: <em>“${escapeHtml(reason)}”</em>` : ""
        }`,
        button: { label: "View details", url: `${base}/sign/${s.id}` },
        footer: "The cancellation is recorded on Stellar along with the other steps. Nothing else is needed from you.",
      }),
    });
    if (!res.ok) console.warn(`[email] cancelled notice to ${s.invited_email} not sent: ${res.reason}`);
  }
}
