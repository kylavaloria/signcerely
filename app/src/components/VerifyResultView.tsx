import { AlertIcon, CheckIcon, ExternalIcon, InfoIcon } from "./icons";
import type { VerifiedRecord, VerifyResult } from "@/lib/verify";

const expertBase = (testnet: boolean) => `https://stellar.expert/explorer/${testnet ? "testnet" : "public"}`;
const short = (w: string) => `${w.slice(0, 4)}…${w.slice(-4)}`;

export function RecordDetails({ record, testnet, contractId }: { record: VerifiedRecord; testnet: boolean; contractId: string }) {
  const ex = expertBase(testnet);
  const statusText =
    record.status === "completed"
      ? `Completed ${record.completedLabel ?? ""}`
      : record.status === "declined"
        ? "Declined"
        : record.status === "cancelled"
          ? "Cancelled"
          : "Waiting for signatures";
  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 18 }}>
        <div>
          <p className="tag">Document</p>
          <p style={{ fontWeight: 700, fontSize: 18 }}>{record.title}</p>
          {record.senderName && <p className="help">Sent by {record.senderName}{record.sentLabel ? ` · ${record.sentLabel}` : ""}</p>}
        </div>
        <div>
          <p className="tag">Status</p>
          <p style={{ fontWeight: 700, fontSize: 18, color: record.status === "completed" ? "var(--green-ink)" : record.status === "pending" ? "var(--blue)" : "var(--red-ink)" }}>
            {statusText}
          </p>
        </div>
      </div>
      <div>
        <p className="tag" style={{ marginBottom: 6 }}>
          Signers
        </p>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {record.signers.map((s) => (
            <li key={s.slot} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderTop: "1px solid var(--line-2)", flexWrap: "wrap" }}>
              <span
                style={{
                  flex: "none",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: s.status === "signed" ? "var(--green-tint)" : s.status === "declined" ? "#FBE9E9" : "var(--line-2)",
                  color: s.status === "signed" ? "var(--green-ink)" : s.status === "declined" ? "#A82E2E" : "var(--ink-3)",
                }}
              >
                {s.status === "signed" ? <CheckIcon size={18} /> : s.slot + 1}
              </span>
              <div style={{ flex: "1 1 220px" }}>
                <p style={{ fontWeight: 600 }}>{s.name}</p>
                <p className="help">
                  {s.status === "signed" ? s.signedLabel ? `Signed ${s.signedLabel}` : "Signed" : s.status === "declined" ? "Declined" : "Not signed"}
                  {s.wallet && (
                    <>
                      {" · wallet "}
                      <span className="mono">{short(s.wallet)}</span>
                    </>
                  )}
                </p>
              </div>
              {s.txHash && (
                <a href={`${ex}/tx/${s.txHash}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 14, minHeight: 44 }}>
                  View on Stellar Expert <ExternalIcon size={14} />
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
      <details>
        <summary className="disclosure">Technical details</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13, paddingTop: 6 }}>
          <div>
            <p className="tag">Signed copy fingerprint recorded on Stellar</p>
            <p className="mono" style={{ wordBreak: "break-all" }}>{record.finalHash ?? "Not completed yet"}</p>
          </div>
          <div>
            <p className="tag">Original file fingerprint</p>
            <p className="mono" style={{ wordBreak: "break-all" }}>{record.originalHash}</p>
          </div>
          <div>
            <p className="tag">On-chain document ID</p>
            <p className="mono" style={{ wordBreak: "break-all" }}>{record.chainDocId}</p>
          </div>
          <div>
            <p className="tag">Contract</p>
            <a className="mono" style={{ wordBreak: "break-all" }} href={`${ex}/contract/${contractId}`} target="_blank" rel="noopener noreferrer">
              {contractId}
            </a>
          </div>
          {record.createTx && (
            <a href={`${ex}/tx/${record.createTx}`} target="_blank" rel="noopener noreferrer">
              Transaction that recorded the original
            </a>
          )}
        </div>
      </details>
    </div>
  );
}

export function VerifyResultView({ result, testnet, contractId }: { result: VerifyResult; testnet: boolean; contractId: string }) {
  if (result.kind === "error") {
    return (
      <p className="note note-red" role="alert">
        <AlertIcon />
        <span>{result.message}</span>
      </p>
    );
  }
  if (result.kind === "none") {
    return (
      <section className="card" aria-labelledby="vr" style={{ overflow: "hidden", borderColor: "#F0CFCF", boxShadow: "none" }}>
        <div role="alert" style={{ background: "#FBE9E9", padding: 28, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: "none", width: 64, height: 64, borderRadius: "50%", background: "var(--red)", display: "grid", placeItems: "center", color: "#fff" }}>
            <AlertIcon size={32} color="#fff" />
          </span>
          <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 id="vr" className="h" style={{ fontSize: 26, fontWeight: 700 }}>
              This file doesn’t match any signed document
            </h2>
            <p style={{ color: "#5C1F1F" }}>It may have been edited after signing, re-saved, scanned, or it’s a different draft. Don’t rely on it as the signed agreement.</p>
          </div>
        </div>
        <div style={{ padding: "18px 28px", display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ color: "var(--ink-2)", fontSize: 14.5 }}>
            Use the signed copy downloaded from It’s Your Sign. Even printing to PDF or saving it again in another app changes the fingerprint.
          </p>
          <p className="help">
            Fingerprint of your file: <span className="mono" style={{ wordBreak: "break-all" }}>{result.fileHash}</span>
          </p>
        </div>
      </section>
    );
  }
  const final = result.kind === "final";
  return (
    <section className="card" aria-labelledby="vr" style={{ overflow: "hidden", borderColor: final ? "#BFE3CF" : "#C9D2F3", boxShadow: "none" }}>
      <div role="status" style={{ background: final ? "var(--green-tint)" : "var(--blue-tint)", padding: 28, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ flex: "none", width: 64, height: 64, borderRadius: "50%", background: final ? "var(--green)" : "var(--blue)", display: "grid", placeItems: "center" }}>
          {final ? <CheckIcon size={34} color="#fff" strokeWidth={2.6} /> : <InfoIcon size={32} color="#fff" />}
        </span>
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 id="vr" className="h" style={{ fontSize: 26, fontWeight: 700 }}>
            {final ? "This document matches the signed version" : "This is the original file that was sent for signing"}
          </h2>
          <p style={{ color: final ? "#1B4D35" : "var(--ink-2)" }}>
            {final
              ? "Nothing has changed since everyone signed it."
              : result.record.status === "completed"
                ? "It isn’t the signed copy — ask for the signed copy, which has everyone’s signatures and a summary page."
                : "It hasn’t been changed since it was sent. Signatures are still being collected."}
          </p>
        </div>
      </div>
      <RecordDetails record={result.record} testnet={testnet} contractId={contractId} />
    </section>
  );
}
