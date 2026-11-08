import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { InfoIcon, SignatureIcon } from "@/components/icons";
import { getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";
import { InviteKeyCatcher } from "./InviteKeyCatcher";

export const metadata: Metadata = { title: "Review and sign · It's Your Sign" };

export default async function SignPage({ params }: { params: Promise<{ signerId: string }> }) {
  const { signerId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(signerId)) notFound();
  const { data } = await db()
    .from("document_signers")
    .select("invited_name, status, documents!inner(title, summary, status, profiles(full_name))")
    .eq("id", signerId)
    .maybeSingle();
  if (!data) notFound();
  const doc = data.documents as unknown as { title: string; summary: string | null; status: string; profiles: { full_name: string } | null };
  const session = await getSession();
  const profile = session ? await getProfile(session.wallet) : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <InviteKeyCatcher signerId={signerId} />
      <SiteHeader user={profile ? { name: profile.full_name, wallet: profile.wallet_address } : null} />
      <div style={{ background: "var(--yellow-tint)", borderBottom: "1px solid #F0DE9C" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ flex: "none", width: 44, height: 44, borderRadius: 12, background: "var(--yellow)", display: "grid", placeItems: "center" }}>
            <SignatureIcon />
          </span>
          <p style={{ fontSize: 18 }}>
            <strong className="h" style={{ fontSize: 21, fontWeight: 700 }}>
              It’s your sign.
            </strong>{" "}
            {doc.profiles?.full_name ?? "Someone"} invited {data.invited_name} to sign this agreement.
          </p>
        </div>
      </div>
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 80px", display: "flex", flexDirection: "column", gap: 20 }}>
        <h1 className="h" style={{ fontSize: 30, fontWeight: 700 }}>
          {doc.title}
        </h1>
        {doc.summary && <p style={{ color: "var(--ink-2)", maxWidth: 680 }}>{doc.summary}</p>}
        <p className="note" style={{ background: "#fff", border: "1px solid var(--line)" }}>
          <InfoIcon />
          <span>
            {doc.status !== "pending"
              ? "This document is no longer waiting for signatures."
              : data.status === "signed"
                ? "You’ve already signed this document."
                : "Signing opens in the next build. Keep this email — you’ll sign from this same link."}
          </span>
        </p>
      </main>
    </div>
  );
}
