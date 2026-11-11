import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ArrowRight, CheckIcon, MailIcon, ShieldIcon, SignatureIcon } from "@/components/icons";
import { getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";

const steps = [
  {
    icon: <SignatureIcon />,
    title: "Upload and invite",
    text: "Add a PDF, choose who signs, and decide if they sign one after another or all at once.",
  },
  {
    icon: <MailIcon />,
    title: "Everyone signs",
    text: "Each person gets an email when it’s their turn, adds their signature, and approves in their wallet.",
  },
  {
    icon: <ShieldIcon />,
    title: "Anyone can check it",
    text: "Download the signed copy. Anyone can confirm who signed and that nothing changed — no account needed.",
  },
];

export default async function Home() {
  const session = await getSession();
  const profile = session ? await getProfile(session.wallet) : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <SiteHeader user={profile ? { name: profile.full_name, wallet: profile.wallet_address } : null} />
      <main>
        <section>
          <div style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 24px 72px", display: "flex", flexDirection: "column", gap: 24, alignItems: "flex-start" }}>
            <span className="tag" style={{ background: "var(--yellow-tint)", color: "var(--navy)", padding: "6px 12px", borderRadius: 999 }}>
              Signing that anyone can check
            </span>
            <h1 className="h" style={{ fontSize: "clamp(44px, 7vw, 84px)", fontWeight: 800, maxWidth: 820 }}>
              Mean it once. We’ll remember.
            </h1>
            <p style={{ fontSize: 20, color: "var(--ink-2)", maxWidth: 620 }}>
              Send an agreement, get everyone’s signature in the right order, and keep a signed copy that proves who
              signed and that nothing changed.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link className="btn btn-primary btn-lg" href={profile ? "/dashboard" : "/sign-in"}>
                {profile ? "Go to your documents" : "Get started"} <ArrowRight />
              </Link>
              <Link className="btn btn-secondary btn-lg" href="/verify">
                Check a signed document
              </Link>
            </div>
            <p className="help" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckIcon size={16} color="#1F9D61" /> Free during beta. You only need a free Varial wallet.
            </p>
          </div>
        </section>

        <section aria-labelledby="how" style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 24px 96px" }}>
          <h2 id="how" className="h" style={{ fontSize: 34, fontWeight: 700, marginBottom: 28 }}>
            How it works
          </h2>
          <ol style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 20 }}>
            {steps.map((s, i) => (
              <li key={s.title} className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
                <span style={{ width: 48, height: 48, borderRadius: 12, background: "var(--blue-tint)", color: "var(--blue)", display: "grid", placeItems: "center" }}>
                  {s.icon}
                </span>
                <p className="tag">Step {i + 1}</p>
                <h3 className="h" style={{ fontSize: 22, fontWeight: 700 }}>
                  {s.title}
                </h3>
                <p style={{ color: "var(--ink-2)" }}>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer style={{ borderTop: "1px solid rgba(255,255,255,.9)", background: "rgba(255,255,255,.6)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: 24, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, fontSize: 13.5, color: "var(--ink-3)" }}>
          <p>© 2026 Signcerely · Beta</p>
          <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldIcon size={13} /> Secured by Stellar
          </p>
        </div>
      </footer>
    </div>
  );
}
