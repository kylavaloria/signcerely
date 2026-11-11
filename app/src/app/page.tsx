import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Chip, DecorLayer, Orb, PixelArt } from "@/components/Decor";
import { ArrowRight, CheckIcon, ShieldIcon } from "@/components/icons";
import { getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";

const steps = [
  {
    icon: <PixelArt name="document" pixel={4} />,
    title: "Upload and invite",
    text: "Add a PDF, choose who signs, and decide if they sign one after another or all at once.",
  },
  {
    icon: <PixelArt name="mail" pixel={4.5} />,
    title: "Everyone signs",
    text: "Each person gets an email when it’s their turn, adds their signature, and approves in their wallet.",
  },
  {
    icon: <PixelArt name="check" pixel={4.5} />,
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
        <section className="decor-host" style={{ overflow: "hidden" }}>
          <DecorLayer>
            <Orb size={300} style={{ right: "max(24px, calc(50% - 560px))", top: 70 }} />
            <Orb size={110} style={{ right: "max(300px, calc(50% - 250px))", top: 330 }} />
            <Orb size={46} tone="yellow" style={{ right: "max(60px, calc(50% - 520px))", top: 40 }} />
            <span className="decor-float" style={{ right: "max(110px, calc(50% - 470px))", top: 120, ["--tilt" as string]: "8deg" }}>
              <PixelArt name="document" pixel={12} />
            </span>
            <span className="decor-float slow" style={{ right: "max(60px, calc(50% - 530px))", top: 300, ["--tilt" as string]: "-10deg" }}>
              <PixelArt name="check" pixel={8} />
            </span>
            <span className="decor-float slow" style={{ right: "max(300px, calc(50% - 250px))", top: 395, ["--tilt" as string]: "-6deg" }}>
              <PixelArt name="cursor" pixel={6} />
            </span>
            <Chip tone="glass" style={{ right: "max(330px, calc(50% - 230px))", top: 118 }}>
              {"{ sign }"}
            </Chip>
            <Chip tone="yellow" style={{ right: "max(40px, calc(50% - 545px))", top: 420 }}>
              • signed
            </Chip>
            <Chip tone="blue" style={{ right: "max(250px, calc(50% - 300px))", top: 460 }}>
              verified
            </Chip>
          </DecorLayer>
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
          <ol style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "56px 20px", paddingTop: 36 }}>
            {steps.map((s, i) => (
              <li key={s.title} className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
                <span className={`step-tile ${i % 2 === 0 ? "yellow" : "blue"}`}>{s.icon}</span>
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
