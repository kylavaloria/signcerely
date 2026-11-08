import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { InfoIcon } from "@/components/icons";
import { getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Check a signed document · It's Your Sign" };

export default async function VerifyPage() {
  const session = await getSession();
  const profile = session ? await getProfile(session.wallet) : null;
  return (
    <div style={{ minHeight: "100vh" }}>
      <SiteHeader current="verify" user={profile ? { name: profile.full_name, wallet: profile.wallet_address } : null} />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "56px 24px 96px", display: "flex", flexDirection: "column", gap: 24, textAlign: "center", alignItems: "center" }}>
        <h1 className="h" style={{ fontSize: "clamp(34px, 4vw, 48px)", fontWeight: 700 }}>
          Check a signed document
        </h1>
        <p style={{ fontSize: 18, color: "var(--ink-3)", maxWidth: 600 }}>
          See who signed it and whether it’s been changed. No account needed — your file stays on your device.
        </p>
        <p className="note" style={{ background: "#fff", border: "1px solid var(--line)", textAlign: "left" }}>
          <InfoIcon />
          <span>Checking documents is coming in the next build.</span>
        </p>
      </main>
    </div>
  );
}
