"use server";

import { getSession } from "@/lib/session";
import { inviteLink, sendInviteEmail } from "@/lib/invites";
import { getProfile } from "@/lib/profile";
import { db } from "@/lib/supabase";

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string };

/** Load a signer of a sent document, only if the caller is that document's sender. */
async function senderOwnedSigner(signerId: string) {
  const session = await getSession();
  if (!session) return null;
  const { data } = await db()
    .from("document_signers")
    .select("id, slot, status, invited_name, invited_email, invite_secret_enc, document_id, documents!inner(sender_wallet, status, title, summary)")
    .eq("id", signerId)
    .maybeSingle();
  const doc = data?.documents as unknown as { sender_wallet: string; status: string; title: string; summary: string | null } | undefined;
  if (!data || !doc || doc.sender_wallet !== session.wallet || doc.status !== "pending") return null;
  return { signer: data, doc, wallet: session.wallet };
}

/** The sender can copy an invite link to share it another way (e.g. chat). */
export async function getInviteLink(signerId: string): Promise<Ok<{ link: string }> | Fail> {
  const found = await senderOwnedSigner(signerId);
  if (!found) return { ok: false, error: "You can’t share this invite." };
  if (found.signer.status === "signed" || found.signer.status === "declined") {
    return { ok: false, error: "This person has already responded." };
  }
  return { ok: true, link: await inviteLink(found.signer.id, found.signer.invite_secret_enc) };
}

/** Email the invite again (at most once a minute). */
export async function resendInvite(signerId: string): Promise<Ok<{ message: string }> | Fail> {
  const found = await senderOwnedSigner(signerId);
  if (!found) return { ok: false, error: "You can’t resend this invite." };
  const { signer, doc, wallet } = found;
  if (signer.status === "waiting") return { ok: false, error: "They’ll be invited automatically when it’s their turn." };
  if (signer.status === "signed" || signer.status === "declined") return { ok: false, error: "This person has already responded." };

  const { data: recent } = await db()
    .from("document_events")
    .select("id")
    .eq("signer_id", signer.id)
    .eq("kind", "reminder_sent")
    .gt("created_at", new Date(Date.now() - 60_000).toISOString())
    .limit(1);
  if (recent?.length) return { ok: false, error: "Sent a moment ago. Wait a minute before sending again." };

  const profile = await getProfile(wallet);
  const r = await sendInviteEmail({ signer, doc, senderName: profile?.full_name ?? "Someone", kind: "reminder" });
  if (!r.ok) return { ok: false, error: r.reason };
  await db().from("document_events").insert({ document_id: signer.document_id, kind: "reminder_sent", signer_id: signer.id, actor_wallet: wallet });
  return { ok: true, message: `Reminder sent to ${signer.invited_email}.` };
}
