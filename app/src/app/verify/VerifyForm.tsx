"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AlertIcon, RetryIcon, Spinner } from "@/components/icons";
import { VerifyResultView } from "@/components/VerifyResultView";
import { prettyBytes } from "@/lib/doc-rules";
import { sha256Hex } from "@/lib/pdf";
import type { VerifyResult } from "@/lib/verify";
import { checkFingerprint } from "./actions";
import { friendlyError } from "@/lib/errors";

const MAX = 25 * 1024 * 1024;

export function VerifyForm({ testnet, contractId, showLink = true }: { testnet: boolean; contractId: string; showLink?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  async function check(f: File | undefined) {
    if (!f) return;
    setResult(null);
    setFile({ name: f.name, size: f.size });
    if (f.size > MAX) return setResult({ kind: "error", message: "That file is over 25 MB." });
    setBusy(true);
    try {
      const hash = await sha256Hex(await f.arrayBuffer());
      setResult(await checkFingerprint(hash));
    } catch (e) {
      setResult({ kind: "error", message: friendlyError(e, "We couldn’t check that file. Try again.") });
    } finally {
      setBusy(false);
    }
  }

  function openLink(e: React.FormEvent) {
    e.preventDefault();
    const m = link.trim().match(/([0-9a-f]{64})/i);
    if (!m) return setLinkError("Paste a verification link like signcerely.com/v/… or the 64-character document ID.");
    setLinkError(null);
    router.push(`/v/${m[1].toLowerCase()}`);
  }

  function reset() {
    setResult(null);
    setFile(null);
    if (input.current) input.current.value = "";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section className="card" aria-label="Choose what to check" style={{ padding: 24, display: "grid", gridTemplateColumns: showLink ? "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" : "1fr", gap: 24, boxShadow: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontWeight: 700 }}>Upload a copy</p>
          <input ref={input} id="v-file" type="file" accept="application/pdf,.pdf" className="visually-hidden" onChange={(e) => check(e.target.files?.[0])} />
          <label
            htmlFor="v-file"
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void check(e.dataTransfer.files?.[0]);
            }}
            style={{
              border: `1.5px ${file ? "solid" : "dashed"} ${drag ? "var(--blue)" : "#C7D0EC"}`,
              background: drag ? "var(--blue-tint)" : "#F7F9FF",
              borderRadius: 12,
              padding: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              minHeight: 70,
            }}
          >
            <span style={{ flex: "none", width: 40, height: 40, borderRadius: 10, background: "var(--blue-tint)", color: "var(--blue)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>
              {busy ? <Spinner size={18} /> : "PDF"}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              {file ? (
                <>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                  <span className="help">{busy ? "Checking…" : `${prettyBytes(file.size)} · checked just now`}</span>
                </>
              ) : (
                <>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 14.5 }}>Choose a PDF or drop it here</span>
                  <span className="help">Your file stays on your device. We only compare its fingerprint.</span>
                </>
              )}
            </span>
            {file && <span style={{ fontWeight: 600, fontSize: 14.5, color: "var(--blue)" }}>Change</span>}
          </label>
        </div>
        {showLink && (
          <form onSubmit={openLink} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label htmlFor="v-link" style={{ fontWeight: 700 }}>
              Or paste a verification link
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input id="v-link" className="input" type="text" placeholder="signcerely.com/v/…" value={link} onChange={(e) => setLink(e.target.value)} aria-invalid={Boolean(linkError)} />
              <button type="submit" className="btn btn-primary">
                Check
              </button>
            </div>
            {linkError && <p className="error-text">{linkError}</p>}
          </form>
        )}
        <p className="note" style={{ gridColumn: "1 / -1" }}>
          <AlertIcon color="#1F3FBF" />
          <span>
            <strong>Tip:</strong> Use the signed copy you downloaded from Signcerely. A printout, scan, or a file saved again in another app will have a
            different fingerprint and won’t match — even if the words look the same.
          </span>
        </p>
      </section>

      {result && (
        <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <VerifyResultView result={result} testnet={testnet} contractId={contractId} />
          <button type="button" className="btn btn-ghost" style={{ alignSelf: "center" }} onClick={reset}>
            <RetryIcon /> Check another document
          </button>
        </div>
      )}
    </div>
  );
}
