import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { confirmEmailToken } from "@/lib/email-confirmation";

export const metadata: Metadata = { title: "Confirm email · Signcerely" };

const messages = {
  invalid: "This confirmation link isn’t valid. It may have been replaced by a newer one.",
  expired: "This confirmation link has expired.",
  changed: "Your profile now uses a different email, so this link no longer applies.",
  taken: "That email is already confirmed on another account, so it can’t be used here.",
};

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result = await confirmEmailToken(token ?? "");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <section className="card" style={{ maxWidth: 480, width: "100%", padding: "clamp(24px, 5vw, 40px)", display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
          {result.ok ? (
            <>
              <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--green-tint)", display: "grid", placeItems: "center" }}>
                <CheckIcon size={28} color="#1F9D61" />
              </span>
              <h1 className="h" style={{ fontSize: 28, fontWeight: 700 }}>
                Email confirmed
              </h1>
              <p className="muted">
                We’ll send signing updates to <strong style={{ color: "var(--navy)" }}>{result.email}</strong>.
              </p>
            </>
          ) : (
            <>
              <span style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--red-tint)", display: "grid", placeItems: "center" }}>
                <AlertIcon size={28} />
              </span>
              <h1 className="h" style={{ fontSize: 28, fontWeight: 700 }}>
                We couldn’t confirm your email
              </h1>
              <p className="muted">
                {messages[result.reason]}{" "}
                {result.reason === "taken" ? "Sign in with the wallet you used before." : "Sign in and send a new link from your dashboard."}
              </p>
            </>
          )}
          <Link className="btn btn-primary" href="/dashboard">
            Go to your documents
          </Link>
        </section>
      </main>
    </div>
  );
}
