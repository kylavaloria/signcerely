import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { RecordDetails } from "@/components/VerifyResultView";
import { getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { chainConfigFromEnv } from "@/lib/stellar/contract";
import { loadRecord } from "@/lib/verify";
import { VerifyForm } from "../../verify/VerifyForm";

export const metadata: Metadata = { title: "Verification record · It's Your Sign" };

/** Shareable record of one document: who signed and when, straight from Stellar. */
export default async function VerificationRecordPage({ params }: { params: Promise<{ chainDocId: string }> }) {
  const { chainDocId } = await params;
  const record = await loadRecord(chainDocId.toLowerCase());
  if (!record) notFound();
  const session = await getSession();
  const profile = session ? await getProfile(session.wallet) : null;
  const c = chainConfigFromEnv();
  const testnet = c.networkPassphrase.includes("Test");
  return (
    <div style={{ minHeight: "100vh" }}>
      <SiteHeader current="verify" user={profile ? { name: profile.full_name, wallet: profile.wallet_address } : null} />
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "48px 24px 96px", display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p className="tag">Verification record</p>
          <h1 className="h" style={{ fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 700 }}>
            {record.title}
          </h1>
          <p className="muted">This record comes straight from the Stellar network. Upload your copy below to check it matches.</p>
        </div>
        <section className="card" style={{ boxShadow: "none" }}>
          <RecordDetails record={record} testnet={testnet} contractId={c.contractId} />
        </section>
        <h2 className="h" style={{ fontSize: 22, fontWeight: 700 }}>
          Does your copy match?
        </h2>
        <VerifyForm testnet={testnet} contractId={c.contractId} showLink={false} />
      </main>
    </div>
  );
}
