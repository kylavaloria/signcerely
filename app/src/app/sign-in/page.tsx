import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInCard } from "@/components/SignInCard";
import { SiteHeader } from "@/components/SiteHeader";
import { LockIcon, MailIcon, PersonIcon } from "@/components/icons";
import { getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in · It's Your Sign" };

const points = [
  { icon: <LockIcon />, text: "Only you can approve a signature in your Varial wallet. We never see your secret key." },
  { icon: <MailIcon />, text: "We’ll email you when it’s your turn to sign and when everyone is done." },
  { icon: <PersonIcon />, text: "Your documents are visible only to the people you invite." },
];

export default async function SignInPage() {
  const session = await getSession();
  if (session) redirect((await getProfile(session.wallet)) ? "/dashboard" : "/welcome");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 24px" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 1080,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))",
            gap: 64,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <h1 className="h" style={{ fontSize: "clamp(36px, 4vw, 52px)", fontWeight: 700, textWrap: "balance" }}>
              Your wallet is your signature.
            </h1>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 20 }}>
              {points.map((p) => (
                <li key={p.text} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span
                    style={{
                      flex: "none",
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "#fff",
                      border: "1px solid var(--line)",
                      color: "var(--blue)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {p.icon}
                  </span>
                  <p style={{ fontSize: 17, color: "var(--ink-2)" }}>{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
          <SignInCard />
        </div>
      </main>
    </div>
  );
}
