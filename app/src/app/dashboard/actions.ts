"use server";

import { getProfile } from "@/lib/profile";
import { sendEmailConfirmation } from "@/lib/email-confirmation";
import { getSession } from "@/lib/session";

export type ResendState = { status: "idle" | "sent" | "error"; message?: string };

export async function resendConfirmation(): Promise<ResendState> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Please sign in again." };
  const profile = await getProfile(session.wallet);
  if (!profile?.email) return { status: "error", message: "Add an email to your profile first." };
  if (profile.email_verified_at) return { status: "sent", message: "Your email is already confirmed." };

  const res = await sendEmailConfirmation({
    wallet: session.wallet,
    email: profile.email,
    name: profile.full_name,
  });
  return res.ok
    ? { status: "sent", message: `Sent. Check ${profile.email} (and the spam folder).` }
    : { status: "error", message: res.reason };
}
