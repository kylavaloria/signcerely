import { PageDecor } from "@/components/Decor";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { chainConfigFromEnv } from "@/lib/stellar/contract";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: "Verify a document · Signcerely" };

export default async function VerifyPage() {
  const session = await getSession();
  const profile = session ? await getProfile(session.wallet) : null;
  const c = chainConfigFromEnv();
  return (
    <div style={{ minHeight: "100vh" }}>
      <SiteHeader current="verify" user={profile ? { name: profile.full_name, wallet: profile.wallet_address } : null} />
      <PageDecor content={720} left="magnifier" right="shield" leftChip="{ verify }" rightChip="• unchanged" />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 96px", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "center", alignItems: "center" }}>
          <h1 className="h" style={{ fontSize: "clamp(34px, 4vw, 48px)", fontWeight: 700 }}>
            Check a signed document
          </h1>
          <p style={{ fontSize: 18, color: "var(--ink-3)", maxWidth: 600 }}>
            See who signed it and whether it’s been changed. No account needed — your file stays on your device; we only compare its fingerprint.
          </p>
        </div>
        <VerifyForm testnet={c.networkPassphrase.includes("Test")} contractId={c.contractId} />
      </main>
    </div>
  );
}
