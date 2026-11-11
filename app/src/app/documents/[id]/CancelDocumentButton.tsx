"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AlertIcon, CloseIcon, Spinner } from "@/components/icons";
import { signTx } from "@/lib/wallet";
import { addTestXlm } from "./review/send-actions";
import { prepareCancel, submitCancel } from "./cancel-actions";
import { friendlyError } from "@/lib/errors";

export function CancelDocumentButton({ documentId, wallet, signedCount }: { documentId: string; wallet: string; signedCount: number }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState<"idle" | "preparing" | "wallet" | "recording">("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsFunds, setNeedsFunds] = useState(false);
  const busy = phase !== "idle";

  async function cancelDoc() {
    setError(null);
    setNeedsFunds(false);
    try {
      setPhase("preparing");
      const prep = await prepareCancel(documentId);
      if (!prep.ok) {
        setNeedsFunds(Boolean(prep.needsFunds));
        throw new Error(prep.error);
      }
      setPhase("wallet");
      const signed = await signTx(prep.xdr, wallet);
      if ("error" in signed) {
        throw new Error(signed.error.kind === "declined" ? "You stopped it in Varial. The document is still active." : signed.error.message);
      }
      setPhase("recording");
      const res = await submitCancel(documentId, signed.signedXdr, reason);
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
    void cancelDoc();
  }

  return (
    <>
      <button type="button" className="btn btn-block" style={{ background: "#fff", color: "var(--red-ink)", borderColor: "#EBC4C4" }} onClick={() => dialog.current?.showModal()}>
        Cancel document
      </button>
      <dialog ref={dialog} className="modal" aria-labelledby="cx-t" style={{ width: "min(520px, calc(100vw - 24px))" }}>
        <div style={{ padding: "24px 26px 8px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <h2 id="cx-t" className="h" style={{ flex: 1, fontSize: 24, fontWeight: 700 }}>
            Cancel this document?
          </h2>
          <button type="button" aria-label="Close" className="btn btn-ghost" style={{ minHeight: 44, padding: "0 10px" }} onClick={() => dialog.current?.close()} disabled={busy}>
            <CloseIcon />
          </button>
        </div>
        <div style={{ padding: "4px 26px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "var(--ink-2)" }}>
            No one will be able to sign it after this, and it can’t be undone.
            {signedCount > 0 && ` The ${signedCount === 1 ? "signature" : `${signedCount} signatures`} already collected stay on record but the document won’t be completed.`}{" "}
            Everyone you’ve invited will get an email. The cancellation is recorded on Stellar.
          </p>
          <div className="field">
            <label htmlFor="cx-reason" className="label">
              Note to signers <span style={{ fontWeight: 500, color: "var(--ink-3)" }}>(optional)</span>
            </label>
            <textarea
              id="cx-reason"
              className="input"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="For example: we’re sending an updated version with the new dates."
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
          <button type="button" className="btn" style={{ background: "var(--red)", color: "#fff" }} onClick={cancelDoc} disabled={busy} aria-busy={busy}>
            {busy && <Spinner />}
            {phase === "wallet" ? "Cancel in Varial…" : phase === "recording" ? "Recording…" : phase === "preparing" ? "Preparing…" : "Cancel document"}
          </button>
        </div>
      </dialog>
    </>
  );
}
