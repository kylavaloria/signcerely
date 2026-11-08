import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { PlusIcon, SignatureIcon } from "@/components/icons";
import { requireUser } from "@/lib/profile";
import { EmailNotice } from "./EmailNotice";

export const metadata: Metadata = { title: "Documents · It's Your Sign" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const user = await requireUser();
  const { email: emailFlag } = await searchParams;
  const justSent = emailFlag === "sent" || emailFlag === "failed" ? emailFlag : null;
  const firstName = user.full_name.split(/\s+/)[0];

  return (
    <div style={{ minHeight: "100vh" }}>
      <SiteHeader current="documents" user={{ name: user.full_name, wallet: user.wallet_address }} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px", display: "flex", flexDirection: "column", gap: 32 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 className="h" style={{ fontSize: 40, fontWeight: 700 }}>
              Hi, {firstName}
            </h1>
            <p className="muted">Nothing is waiting for you right now.</p>
          </div>
          <button type="button" className="btn btn-primary" aria-disabled="true" title="Coming in the next build">
            <PlusIcon /> New document
          </button>
        </div>

        {!user.email_verified_at && user.email && <EmailNotice email={user.email} justSent={justSent} />}

        <section
          className="card"
          aria-labelledby="empty-title"
          style={{ padding: "56px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}
        >
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--yellow-tint)",
              display: "grid",
              placeItems: "center",
              color: "var(--navy)",
            }}
          >
            <SignatureIcon size={30} />
          </span>
          <h2 id="empty-title" className="h" style={{ fontSize: 26, fontWeight: 700 }}>
            No documents yet
          </h2>
          <p className="muted" style={{ maxWidth: 460 }}>
            Upload a PDF, choose who signs and in what order, and we’ll email each person when it’s their turn.
          </p>
        </section>
      </main>
    </div>
  );
}
