"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AlertIcon, CloseIcon, Spinner } from "@/components/icons";
import { signTx } from "@/lib/wallet";
import { addTestXlm } from "@/app/documents/[id]/review/send-actions";
import { prepareDecline, submitDecline } from "./actions";
import { friendlyError } from "@/lib/errors";

export function DeclineButton({ signerId, wallet, senderName }: { signerId: string; wallet: string; senderName: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState<"idle" | "preparing" | "wallet" | "recording">("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsFunds, setNeedsFunds] = useState(false);
  const busy = phase !== "idle";

  async function decline() {
    setError(null);
    setNeedsFunds(false);
    try {
      setPhase("preparing");
      const prep = await prepareDecline(signerId);
      if (!prep.ok) {
        setNeedsFunds(Boolean(prep.needsFunds));
        throw new Error(prep.error);
      }
      setPhase("wallet");
      const signed = await signTx(prep.xdr, wallet);
      if ("error" in signed) {
        throw new Error(signed.error.kind === "declined" ? "You cancelled in Varial. Nothing was recorded." : signed.error.message);
      }
      setPhase("recording");
      const res = await submitDecline(signerId, signed.signedXdr, reason);
      if (!res.ok) throw new Error(res.error);
      dialog.current?.close();
      router.refresh();
    } catch (e) {
      setError(friendlyError(e));
      setPhase("idle");
    }
  }

  async function fund() {
    setPhase("preparing");
    const r = await addTestXlm();
    setPhase("idle");
    if (!r.ok) return setError(r.error);
    void decline();
  }

  return (
    <>
      <button type="button" className="btn btn-block" style={{ background: "#fff", color: "var(--red-ink)", borderColor: "#EBC4C4" }} onClick={() => dialog.current?.showModal()}>
        Decline
      </button>
      <dialog ref={dialog} className="modal" aria-labelledby="dc-t" style={{ width: "min(520px, calc(100vw - 24px))" }}>
        <div style={{ padding: "24px 26px 8px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <h2 id="dc-t" className="h" style={{ flex: 1, fontSize: 24, fontWeight: 700 }}>
            Decline to sign?
          </h2>
          <button type="button" aria-label="Close" className="btn btn-ghost" style={{ minHeight: 44, padding: "0 10px" }} onClick={() => dialog.current?.close()} disabled={busy}>
            <CloseIcon />
          </button>
        </div>
        <div style={{ padding: "4px 26px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "var(--ink-2)" }}>
            The document stops for everyone and can’t be signed after this. {senderName} will be told, and the decline is recorded on Stellar.
          </p>
          <div className="field">
            <label htmlFor="dc-reason" className="label">
              Reason <span style={{ fontWeight: 500, color: "var(--ink-3)" }}>(optional, shared with {senderName})</span>
            </label>
            <textarea
              id="dc-reason"
              className="input"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="For example: the fee in section 3 should be ₱400,000."
              style={{ height: "auto", padding: "12px 14px", resize: "vertical", lineHeight: 1.45 }}
            />
          </div>
          {error && (
            <p className="note note-red" role="alert">
              <AlertIcon />
              <span>
                {error}{" "}
                {needsFunds && (
                  <button type="button" onClick={fund} style={{ border: 0, background: "none", padding: 0, font: "inherit", fontWeight: 700, color: "var(--blue)", textDecoration: "underline", cursor: "pointer" }}>
                    Add free test XLM
                  </button>
                )}
              </span>
            </p>
          )}
        </div>
        <div style={{ padding: "14px 26px 20px", borderTop: "1px solid var(--line-2)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()} disabled={busy}>
            Keep it
          </button>
          <button type="button" className="btn" style={{ background: "var(--red)", color: "#fff" }} onClick={decline} disabled={busy} aria-busy={busy}>
            {busy && <Spinner />}
            {phase === "wallet" ? "Approve in Varial…" : phase === "recording" ? "Recording…" : phase === "preparing" ? "Preparing…" : "Decline"}
          </button>
        </div>
      </dialog>
    </>
  );
}
