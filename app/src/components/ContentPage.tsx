import Link from "next/link";
import type { ArtName } from "@/components/Decor";
import { PageDecor } from "@/components/Decor";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";

/** Layout for public guide pages: header, a centered article, a call to action and the footer. */
export async function ContentPage({
  eyebrow,
  title,
  intro,
  left = "document",
  right = "check",
  children,
}: {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  left?: ArtName;
  right?: ArtName;
  children: React.ReactNode;
}) {
  const session = await getSession();
  const profile = session ? await getProfile(session.wallet) : null;
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader user={profile ? { name: profile.full_name, wallet: profile.wallet_address } : null} />
      <PageDecor content={720} left={left} right={right} />
      <main style={{ flex: 1, width: "100%", maxWidth: 820, margin: "0 auto", padding: "56px 24px 88px" }}>
        <article className="prose">
          <header style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36 }}>
            <span className="tag" style={{ alignSelf: "flex-start", background: "var(--yellow-tint)", color: "var(--navy)", padding: "6px 12px", borderRadius: 999 }}>
              {eyebrow}
            </span>
            <h1 className="h" style={{ fontSize: "clamp(34px, 5vw, 52px)", fontWeight: 800 }}>
              {title}
            </h1>
            <div className="lead">{intro}</div>
          </header>
          {children}
        </article>
        <aside className="card prose-cta" aria-label="Get started">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 280px" }}>
            <p className="h" style={{ fontSize: 24, fontWeight: 700 }}>
              Ready to send your first document?
            </p>
            <p style={{ color: "var(--ink-2)" }}>Upload a PDF, add who needs to sign, and send it in a few minutes.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href={profile ? "/documents/new" : "/sign-in"}>
              Get started
            </Link>
            <Link className="btn btn-secondary" href="/verify">
              Check a document
            </Link>
          </div>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
