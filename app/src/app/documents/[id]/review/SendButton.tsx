"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertIcon, ArrowRight, Spinner } from "@/components/icons";
import { signTx } from "@/lib/wallet";
import { addTestXlm, prepareSend, submitSend } from "./send-actions";
import { friendlyError } from "@/lib/errors";

type Phase = "idle" | "preparing" | "wallet" | "recording" | "funding";

const LABEL: Record<Phase, string> = {
  idle: "Send for signing",
  preparing: "Preparing…",
  wallet: "Approve in Varial…",
  recording: "Recording on Stellar…",
  funding: "Adding test XLM…",
};

export function SendButton({
  documentId,
  wallet,
  blocked,
}: {
  documentId: string;
  wallet: string;
  blocked?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsFunds, setNeedsFunds] = useState(false);

  async function send() {
    setError(null);
    setNeedsFunds(false);
    try {
      setPhase("preparing");
      const prep = await prepareSend(documentId);
      if (!prep.ok) {
        setNeedsFunds(Boolean(prep.needsFunds));
        throw new Error(prep.error);
      }
      setPhase("wallet");
      const signed = await signTx(prep.xdr, wallet);
      if ("error" in signed) {
        throw new Error(
          signed.error.kind === "declined"
            ? "You declined in Varial. Nothing was sent."
            : signed.error.message,
        );
      }
      setPhase("recording");
      const done = await submitSend(documentId, signed.signedXdr);
      if (!done.ok) throw new Error(done.error);
      const next = done.emailFailed.length
        ? `${done.next}&emailFailed=${encodeURIComponent(done.emailFailed.join(", "))}`
        : done.next;
      router.push(next);
    } catch (e) {
      setError(friendlyError(e));
      setPhase("idle");
    }
  }

  async function fund() {
    setError(null);
    setPhase("funding");
    const r = await addTestXlm();
    setPhase("idle");
    if (!r.ok) return setError(r.error);
    setNeedsFunds(false);
    void send();
  }

  // Errors show in the page body (above the action bar), not squeezed next to the button.
  // `error` is only ever set in the browser, so reading the DOM here is safe.
  const slot = error ? document.getElementById("send-error-slot") : null;
  useEffect(() => {
    if (error) document.getElementById("send-error-slot")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  const busy = phase !== "idle";
  const errorNote = error && (
    <p className="note note-red" role="alert">
      <AlertIcon />
      <span>
        {error}
        {needsFunds && (
          <>
            {" "}
            <button
              type="button"
              onClick={fund}
              disabled={busy}
              style={{
                border: 0,
                background: "none",
                padding: 0,
                font: "inherit",
                fontWeight: 700,
                color: "var(--blue)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Add free test XLM
            </button>
          </>
        )}
      </span>
    </p>
  );
  return (
    <>
      {errorNote && (slot ? createPortal(errorNote, slot) : errorNote)}
      <button
        type="button"
        className="btn btn-primary"
        onClick={send}
        disabled={busy || Boolean(blocked)}
        aria-busy={busy}
        title={blocked}
      >
        {busy ? <Spinner /> : null}
        {LABEL[phase]}
        {!busy && <ArrowRight />}
      </button>
    </>
  );
}
