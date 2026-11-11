import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge, Chip, DecorLayer, Orb, PixelArt } from "@/components/Decor";
import { ArrowRight, CheckIcon, Logo, ShieldIcon } from "@/components/icons";
import { Reveal } from "@/components/Reveal";
import { ScrollInk } from "@/components/ScrollInk";
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

const reasons = [
  {
    art: "check" as const,
    title: "Every signature is recorded permanently",
    text: "When someone signs, we save who signed and exactly when. That record can’t be edited or deleted, not even by us.",
  },
  {
    art: "magnifier" as const,
    title: "Anyone can verify",
    text: "Share a link or a copy of the file. Anyone can confirm who signed it and when. No account, no wallet, no cost.",
  },
  {
    art: "shield" as const,
    title: "No secret edits",
    text: "Signatures are tied to the exact file everyone saw. Change a single comma afterwards and the check will show it’s a different version.",
  },
];

const faqs = [
  {
    q: "Do I need any technical know-how?",
    a: "No. You upload, invite and sign like any e-signature app. The permanent record is kept for you in the background. If you’re curious, every document has a “Technical details” section.",
  },
  {
    q: "What is Varial, and why do I need it?",
    a: "Varial is a free, secure wallet that works in your browser. It acts as your personal signing key, so only you can sign as you.",
  },
  {
    q: "Does it cost anything?",
    a: "Sending documents is free. Each signature has a very small network fee, paid from the signer’s wallet. During beta the fee is paid in free test XLM, and you can add some with one click if your wallet is empty.",
  },
  {
    q: "Who can see my document?",
    a: "Only the people you invite can open it. The permanent record keeps only a fingerprint of the file and the signatures, never the document itself.",
  },
  {
    q: "Is a signature here legally binding?",
    a: "That depends on where you are and what you’re signing. Signcerely gives you a clear, tamper-proof record of who signed which version and when. For high-stakes agreements, check with a lawyer.",
  },
];

const sample = [
  { name: "Lea Santos", date: "Signed Nov 3, 2026" },
  { name: "Miguel Tan", date: "Signed Nov 4, 2026" },
  { name: "Ana Reyes", date: "Signed Nov 5, 2026" },
];

export default async function Home() {
  const session = await getSession();
  const profile = session ? await getProfile(session.wallet) : null;

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="scroll-progress" aria-hidden="true" />
      <SiteHeader user={profile ? { name: profile.full_name, wallet: profile.wallet_address } : null} />
      <main className="landing-main">
        <ScrollInk />
        <section className="decor-host hero" style={{ overflow: "hidden" }}>
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
            <span className="tag enter" style={{ background: "var(--yellow-tint)", color: "var(--navy)", padding: "6px 12px", borderRadius: 999 }}>
              Signing that anyone can check
            </span>
            <h1 className="h enter" style={{ fontSize: "clamp(44px, 7vw, 84px)", fontWeight: 800, maxWidth: 820, ["--d" as string]: "90ms" }}>
              Mean it once. We’ll{" "}
              <span className="ink-word">
                remember.
                <svg aria-hidden="true" viewBox="0 0 300 24" preserveAspectRatio="none">
                  <path d="M4 14 C 40 4, 70 22, 110 12 S 180 4, 215 14 S 270 20, 296 8" pathLength={1} />
                </svg>
              </span>
            </h1>
            <p className="enter" style={{ fontSize: 20, color: "var(--ink-2)", maxWidth: 620, ["--d" as string]: "200ms" }}>
              Send an agreement, get everyone’s signature in the right order, and keep a signed copy that proves who
              signed and that nothing changed.
            </p>
            <div className="enter" style={{ display: "flex", gap: 12, flexWrap: "wrap", ["--d" as string]: "310ms" }}>
              <Link className="btn btn-primary btn-lg" href={profile ? "/dashboard" : "/sign-in"}>
                {profile ? "Go to your documents" : "Get started"} <ArrowRight />
              </Link>
              <Link className="btn btn-secondary btn-lg" href="/verify">
                Check a signed document
              </Link>
            </div>
            <p className="help enter" style={{ display: "flex", alignItems: "center", gap: 8, ["--d" as string]: "400ms" }}>
              <CheckIcon size={16} color="#1F9D61" /> Free during beta. You only need a free Varial wallet.
            </p>
          </div>
        </section>

        <section aria-labelledby="how" style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 24px 96px", scrollMarginTop: 24 }}>
          <Reveal>
            <h2 id="how" className="h" style={{ fontSize: 34, fontWeight: 700, marginBottom: 28 }}>
              How it works
            </h2>
          </Reveal>
          <ol style={{ listStyle: "none", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "56px 20px", paddingTop: 36 }}>
            {steps.map((s, i) => (
              <Reveal as="li" from="pixels" delay={i * 160} key={s.title} className="card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
                <span className={`step-tile ${i % 2 === 0 ? "yellow" : "blue"}`}>{s.icon}</span>
                <p className="tag">Step {i + 1}</p>
                <h3 className="h" style={{ fontSize: 22, fontWeight: 700 }}>
                  {s.title}
                </h3>
                <p style={{ color: "var(--ink-2)" }}>{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        <section aria-labelledby="why" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 96px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(400px, 100%), 1fr))", gap: 48, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <Reveal from="left" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p className="tag" style={{ color: "var(--blue)" }}>
                  Why it’s different
                </p>
                <h2 id="why" className="h" style={{ fontSize: "clamp(30px, 4vw, 40px)", fontWeight: 700, maxWidth: 440 }}>
                  A record no one can quietly rewrite.
                </h2>
              </Reveal>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 22 }}>
                {reasons.map((r, i) => (
                  <Reveal as="li" from="left" delay={120 + i * 120} key={r.title} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <Badge name={r.art} size={52} pixel={2.8} tone={i === 0 ? "yellow" : "blue"} />
                    <div>
                      <h3 style={{ fontSize: 17, marginBottom: 4 }}>{r.title}</h3>
                      <p style={{ color: "var(--ink-2)", fontSize: 15.5 }}>{r.text}</p>
                    </div>
                  </Reveal>
                ))}
              </ul>
            </div>

            {/* Example of what a check shows. Sample names, not real people. */}
            <Reveal from="pixels" delay={100} className="example-card">
            <span aria-hidden="true" className="stamp">Verified</span>
            <div aria-label="Example verification result" role="img" className="card" style={{ padding: "clamp(18px, 4vw, 28px)", display: "flex", flexDirection: "column", gap: 14 }}>
              <p className="tag">Example</p>
              <div className="card" style={{ boxShadow: "none", padding: 20, display: "flex", flexDirection: "column", gap: 14, background: "rgba(255,255,255,.9)" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ flex: "none", width: 40, height: 40, borderRadius: "50%", background: "var(--green-tint)", display: "grid", placeItems: "center" }}>
                    <CheckIcon size={20} color="#1F9D61" />
                  </span>
                  <div>
                    <p style={{ fontWeight: 700, color: "var(--green-ink)" }}>This document matches the signed version</p>
                    <p className="help">Sponsorship Agreement – Community Hackathon</p>
                  </div>
                </div>
                <dl className="detail-rows" style={{ borderTop: "1px solid var(--line-2)", paddingTop: 14 }}>
                  {sample.map((p, i) => (
                    <div key={p.name} className="seq-row" style={{ gridTemplateColumns: "1fr auto", ["--i" as string]: i }}>
                      <dt style={{ color: "var(--navy)", fontWeight: 600 }}>{p.name}</dt>
                      <dd style={{ color: "var(--ink-3)" }}>{p.date}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="card" style={{ boxShadow: "none", padding: "14px 20px", display: "flex", gap: 12, alignItems: "center", background: "rgba(255,255,255,.9)" }}>
                <span style={{ flex: "none", width: 32, height: 32, borderRadius: "50%", background: "#FBE9E9", color: "var(--red-ink)", display: "grid", placeItems: "center", fontWeight: 700 }}>×</span>
                <p style={{ fontSize: 14.5, color: "var(--ink-2)" }}>
                  <strong style={{ color: "var(--navy)" }}>Edited copy?</strong> We’ll tell you it’s different from what was signed.
                </p>
              </div>
            </div>
            </Reveal>
          </div>
        </section>

        <section aria-labelledby="faq" style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 96px", scrollMarginTop: 24 }}>
          <Reveal>
            <h2 id="faq" className="h" style={{ fontSize: "clamp(30px, 4vw, 40px)", fontWeight: 700, marginBottom: 24 }}>
              Questions, answered
            </h2>
          </Reveal>
          <Reveal delay={120} className="card" style={{ padding: "4px 24px" }}>
            {faqs.map((f, i) => (
              <details key={f.q} open={i === 0} style={{ borderTop: i ? "1px solid var(--line-2)" : 0 }}>
                <summary className="disclosure" style={{ fontSize: 16 }}>
                  {f.q}
                </summary>
                <p style={{ color: "var(--ink-2)", paddingBottom: 18, maxWidth: 620 }}>{f.a}</p>
              </details>
            ))}
          </Reveal>
        </section>

        <section aria-labelledby="cta" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px 96px" }}>
          <Reveal from="scale" className="cta-band decor-host">
            <DecorLayer>
              <Orb size={150} style={{ right: 210, top: -60, opacity: 0.55 }} />
              <span className="cta-cursor" style={{ right: 250, bottom: 18 }}>
                <PixelArt name="cursor" pixel={5} />
              </span>
            </DecorLayer>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 320px" }}>
              <h2 id="cta" style={{ fontFamily: "var(--font-head)", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, color: "#fff", maxWidth: 420 }}>
                Your next agreement starts here.
              </h2>
              <p style={{ color: "#fff", fontSize: 17 }}>Upload a PDF, add who needs to sign, and send it in a few minutes.</p>
            </div>
            <Link className="btn btn-sign btn-lg" href={profile ? "/documents/new" : "/sign-in"}>
              Get started
            </Link>
          </Reveal>
        </section>
      </main>
      <footer style={{ borderTop: "1px solid rgba(255,255,255,.9)", background: "rgba(255,255,255,.6)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 24px", display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 17 }}>
                <Logo size={30} /> Signcerely
              </span>
              <p style={{ color: "var(--blue)", fontSize: 14.5 }}>Mean it once. We’ll remember.</p>
            </div>
            <nav aria-label="Product" className="footer-col">
              <p className="tag">Product</p>
              <a href="#how">How it works</a>
              <Link href="/verify">Verify a document</Link>
              <a href="#faq">FAQ</a>
            </nav>
            <nav aria-label="Help" className="footer-col">
              <p className="tag">Help</p>
              <a href="https://varialwallet.com" target="_blank" rel="noopener noreferrer">
                Get Varial
              </a>
            </nav>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, fontSize: 13.5, color: "var(--ink-3)", borderTop: "1px solid var(--line-2)", paddingTop: 18 }}>
            <p>© 2026 Signcerely. All rights reserved.</p>
            <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldIcon size={13} /> Secured by Stellar
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
