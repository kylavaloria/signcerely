"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { unlockInvite } from "./actions";

/**
 * Invite links end in #k=<invite secret>. Check it with the server once
 * (which remembers it for this browser), then tidy the address bar so the
 * secret isn't left on screen. `locked` = the page is waiting for this.
 */
export function InviteKeyCatcher({ signerId, locked }: { signerId: string; locked: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "checking" | "bad" | "none">("idle");

  useEffect(() => {
    const m = window.location.hash.match(/^#k=([0-9a-f]{64})$/);
    let key = m?.[1] ?? null;
    if (m) history.replaceState(null, "", window.location.pathname + window.location.search);
    try {
      if (key) sessionStorage.setItem(`sc-invite:${signerId}`, key);
      else key = sessionStorage.getItem(`sc-invite:${signerId}`);
    } catch {
      // storage blocked; the link can be opened again
    }
    if (!locked) return;
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("none");
      return;
    }
    setState("checking");
    void unlockInvite(signerId, key).then((r) => {
      if (r.ok) router.refresh();
      else setState("bad");
    });
  }, [signerId, locked, router]);

  if (!locked || state === "idle") return null;
  return (
    <p className="note" role="status" style={{ background: "#fff", border: "1px solid var(--line)" }}>
      <span>
        {state === "checking"
          ? "Opening your invite…"
          : state === "bad"
            ? "This invite link doesn’t look right. Open it again from your email."
            : "To see this document, open it from your invite email, or sign in with the email address it was sent to."}
      </span>
    </p>
  );
}
