import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { CheckIcon } from "@/components/icons";
import { shortAddress } from "@/lib/format";
import { getInvitePrefill, getProfile } from "@/lib/profile";
import { getSession } from "@/lib/session";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Finish your profile · It's Your Sign" };

export default async function WelcomePage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (await getProfile(session.wallet)) redirect("/dashboard");

  const invite = await getInvitePrefill(session.wallet);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <section
          className="card"
          aria-labelledby="pf-title"
          style={{ width: "100%", maxWidth: 520, padding: "clamp(24px, 5vw, 40px)", display: "flex", flexDirection: "column", gap: 24 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p className="tag">One-time setup</p>
            <h1 id="pf-title" className="h" style={{ fontSize: 30, fontWeight: 700 }}>
              Finish your profile
            </h1>
            <p className="muted">Tell us who you are so people know who signed.</p>
          </div>

          <p className="note note-green" style={{ alignItems: "center" }}>
            <CheckIcon color="#1F9D61" />
            <span>
              <strong>Freighter connected</strong>{" "}
              <span className="mono" style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 400 }}>
                · {shortAddress(session.wallet)}
              </span>
            </span>
          </p>

          <ProfileForm
            defaults={{ fullName: invite?.name ?? "", email: invite?.email ?? "" }}
            invite={invite ? { invitedBy: invite.invitedBy, invitedAs: invite.name } : null}
          />
        </section>
      </main>
    </div>
  );
}
