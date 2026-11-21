import Link from "next/link";
import { Logo, ShieldIcon } from "@/components/icons";

/** Site-wide footer. Links here also help search engines find every public page. */
export function SiteFooter() {
  return (
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
            <Link href="/how-it-works">How it works</Link>
            <Link href="/verify">Verify a document</Link>
            <Link href="/faq">FAQ</Link>
          </nav>
          <nav aria-label="Guides" className="footer-col">
            <p className="tag">Guides</p>
            <Link href="/verify-a-signed-pdf">Check if a signed PDF was changed</Link>
            <Link href="/sign-a-freelance-contract-online">Sign a freelance contract</Link>
            <Link href="/sign-a-lease-online">Sign a lease online</Link>
            <Link href="/multiple-signers-in-order">Several signers, in order</Link>
          </nav>
          <nav aria-label="Help" className="footer-col">
            <p className="tag">Help</p>
            <a href="https://varialwallet.com" target="_blank" rel="noopener noreferrer">
              Get Varial
            </a>
            <a href="https://github.com/kylavaloria/signcerely" target="_blank" rel="noopener noreferrer">
              Source code
            </a>
          </nav>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, fontSize: 13.5, color: "var(--ink-3)", borderTop: "1px solid var(--line-2)", paddingTop: 18 }}>
          <p style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
            <span>© 2026 Signcerely. All rights reserved.</span>
            <Link href="/privacy" style={{ color: "inherit" }}>
              Privacy
            </Link>
            <Link href="/terms" style={{ color: "inherit" }}>
              Terms
            </Link>
          </p>
          <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldIcon size={13} /> Secured by Stellar
          </p>
        </div>
      </div>
    </footer>
  );
}
