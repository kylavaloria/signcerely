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
