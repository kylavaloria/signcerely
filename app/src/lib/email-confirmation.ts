import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { appUrl, escapeHtml, layout, sendEmail, type SendResult } from "./email";
import { db } from "./supabase";

const TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Create a one-time confirmation link for this wallet's email and send it. */
export async function sendEmailConfirmation(input: {
  wallet: string;
  email: string;
  name: string;
}): Promise<SendResult> {
  // Don't let the button be spammed.
  const { data: recent } = await db()
    .from("email_verifications")
    .select("created_at")
    .eq("wallet_address", input.wallet)
    .gt("created_at", new Date(Date.now() - RESEND_COOLDOWN_MS).toISOString())
    .limit(1);
  if (recent && recent.length > 0) {
    return { ok: false, reason: "We just sent one. Wait a minute before asking again." };
  }

  const token = randomBytes(32).toString("hex");
  const { error } = await db().from("email_verifications").insert({
    token_hash: sha256(token),
    wallet_address: input.wallet,
    email: input.email,
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
  });
  if (error) {
    console.error("email_verifications insert failed", error);
    return { ok: false, reason: "Couldn't create a confirmation link." };
  }

  const url = `${await appUrl()}/confirm-email?token=${token}`;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] confirmation link for ${input.email}: ${url}`);
  }
  const first = input.name.split(/\s+/)[0];
  return sendEmail({
    to: input.email,
    subject: "Confirm your email for Signcerely",
    text: `Hi ${first},\n\nConfirm this email so we can tell you when it's your turn to sign:\n${url}\n\nThe link works for 24 hours. If you didn't sign up for Signcerely, you can ignore this email.`,
    html: layout({
      heading: "Confirm your email",
      body: `Hi ${escapeHtml(first)}, confirm this address so we can tell you when it’s your turn to sign and when everyone is done.`,
      button: { label: "Confirm email", url },
      footer: "This link works for 24 hours. If you didn’t sign up for Signcerely, you can ignore this email.",
    }),
  });
}

/** Use a confirmation token once. Returns the confirmed email, or why it failed. */
export async function confirmEmailToken(
  token: string,
): Promise<{ ok: true; email: string } | { ok: false; reason: "invalid" | "expired" | "changed" | "taken" }> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false, reason: "invalid" };
  const hash = sha256(token);

  const { data: row } = await db()
    .from("email_verifications")
    .select("wallet_address, email, expires_at, used_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!row) return { ok: false, reason: "invalid" };

  // Already used: treat as success if that email is confirmed (people click twice).
  if (row.used_at) {
    const { data: p } = await db()
      .from("profiles")
      .select("email, email_verified_at")
      .eq("wallet_address", row.wallet_address)
      .maybeSingle();
    return p?.email_verified_at && p.email === row.email
      ? { ok: true, email: row.email }
      : { ok: false, reason: "invalid" };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };

  await db().from("email_verifications").update({ used_at: new Date().toISOString() }).eq("token_hash", hash);

  // Only confirm if the profile still uses this email.
  const { data: updated, error } = await db()
    .from("profiles")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("wallet_address", row.wallet_address)
    .eq("email", row.email)
    .select("email");
  // Someone else confirmed this address first (unique index on confirmed emails).
  if (error?.code === "23505") return { ok: false, reason: "taken" };
  if (!updated || updated.length === 0) return { ok: false, reason: "changed" };
  return { ok: true, email: row.email };
}
