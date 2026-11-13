"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Sign out of this wallet and go back to sign-in, keeping where they were headed. */
export function SwitchWallet({ next }: { next: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="link-button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
        router.refresh();
      }}
    >
      {busy ? "Switching…" : "Use a different wallet"}
    </button>
  );
}
