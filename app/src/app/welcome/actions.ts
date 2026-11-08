"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sendEmailConfirmation } from "@/lib/email-confirmation";
import { safeNext } from "@/lib/format";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your full name.")
    .max(120, "Keep your name under 120 characters."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
});

export type ProfileFormState = {
  errors?: { fullName?: string; email?: string; form?: string };
  values?: { fullName: string; email: string };
};

export async function saveProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return { errors: { fullName: f.fullName?.[0], email: f.email?.[0] }, values: raw };
  }

  const { error } = await db()
    .from("profiles")
    .upsert(
      {
        wallet_address: session.wallet,
        full_name: parsed.data.fullName,
        email: parsed.data.email,
      },
      { onConflict: "wallet_address" },
    );
  if (error) {
    console.error("profile upsert failed", error);
    return { errors: { form: "Couldn't save your profile. Please try again." }, values: raw };
  }

  // Send the confirmation link. If it fails, the dashboard offers "Send again".
  const sent = await sendEmailConfirmation({
    wallet: session.wallet,
    email: parsed.data.email,
    name: parsed.data.fullName,
  });
  const next = safeNext(formData.get("next"));
  redirect(next ?? (sent.ok ? "/dashboard?email=sent" : "/dashboard?email=failed"));
}
