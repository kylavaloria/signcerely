import Link from "next/link";
import { Logo } from "./icons";
import { UserMenu } from "./UserMenu";

type Props = {
  current?: "documents" | "verify";
  user?: { name: string; wallet: string } | null;
};

export function SiteHeader({ current, user }: Props) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href={user ? "/dashboard" : "/"} className="brand" aria-label="It's Your Sign home">
          <Logo />
          <span className="h" style={{ fontSize: 21, fontWeight: 700 }}>
            It’s Your Sign
          </span>
          <span className="beta">Beta</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {user && (
            <Link href="/dashboard" aria-current={current === "documents" ? "page" : undefined}>
              Documents
            </Link>
          )}
          <Link href="/verify" aria-current={current === "verify" ? "page" : undefined}>
            Verify a document
          </Link>
        </nav>
        {user ? (
          <UserMenu name={user.name} wallet={user.wallet} />
        ) : (
          <Link className="btn btn-secondary" href="/sign-in" style={{ minHeight: 44 }}>
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
