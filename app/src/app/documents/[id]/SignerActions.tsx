"use client";

import { useState } from "react";
import { getInviteLink, resendInvite } from "./actions";

const small: React.CSSProperties = { minHeight: 38, padding: "0 12px", fontSize: 13.5 };

export function SignerActions({ signerId, canResend }: { signerId: string; canResend: boolean }) {
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState<"copy" | "resend" | null>(null);

  async function copy() {
    setBusy("copy");
    setMsg(null);
    const r = await getInviteLink(signerId);
    setBusy(null);
    if (!r.ok) return setMsg({ text: r.error, bad: true });
    try {
      await navigator.clipboard.writeText(r.link);
      setMsg({ text: "Link copied. Send it only to this person — it lets them sign." });
    } catch {
      window.prompt("Copy this invite link:", r.link);
    }
  }

  async function resend() {
    setBusy("resend");
    setMsg(null);
    const r = await resendInvite(signerId);
    setBusy(null);
    setMsg(r.ok ? { text: r.message } : { text: r.error, bad: true });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-secondary" style={small} onClick={copy} disabled={busy !== null}>
          {busy === "copy" ? "Copying…" : "Copy invite link"}
        </button>
        {canResend && (
          <button type="button" className="btn btn-ghost" style={small} onClick={resend} disabled={busy !== null}>
            {busy === "resend" ? "Sending…" : "Email again"}
          </button>
        )}
      </div>
      {msg && (
        <p role="status" style={{ fontSize: 13, color: msg.bad ? "var(--red-ink)" : "var(--green-ink)", maxWidth: 320, textAlign: "right" }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
