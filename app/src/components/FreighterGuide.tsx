"use client";

import { forwardRef } from "react";
import { CloseIcon, ExternalIcon, RetryIcon } from "./icons";

type Props = { onCheckAgain: () => void };

const step = { display: "flex", gap: 16, padding: "18px 0", borderTop: "1px solid var(--line-2)" } as const;
const num = {
  flex: "none",
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "var(--blue)",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  fontSize: 14.5,
} as const;

/** "Set up Freighter in 3 steps" popup. Open with ref.current.showModal(). */
export const FreighterGuide = forwardRef<HTMLDialogElement, Props>(function FreighterGuide(
  { onCheckAgain },
  ref,
) {
  const close = () => (ref as React.RefObject<HTMLDialogElement | null>).current?.close();
  return (
    <dialog ref={ref} className="modal" aria-labelledby="fg-title">
      <div style={{ padding: "26px 28px 18px", display: "flex", gap: 16, borderBottom: "1px solid var(--line-2)" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <p className="tag">About 2 minutes</p>
          <h2 id="fg-title" className="h" style={{ fontSize: 26, fontWeight: 700 }}>
            Set up Freighter in 3 steps
          </h2>
          <p className="muted" style={{ fontSize: 15 }}>
            Freighter is a free browser extension that holds your signing key. You only do this once.
          </p>
        </div>
        <button type="button" aria-label="Close" className="btn btn-ghost" style={{ minHeight: 44, padding: "0 10px" }} onClick={close}>
          <CloseIcon />
        </button>
      </div>
      <ol style={{ listStyle: "none", padding: "4px 28px 8px" }}>
        <li style={{ ...step, borderTop: 0 }}>
          <span style={num} aria-hidden="true">1</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ fontSize: 17 }}>Install Freighter</h3>
            <p style={{ fontSize: 14.5, color: "var(--ink-2)" }}>
              Add it to Chrome, Brave or Firefox from the official site, then pin it: click the puzzle icon in your
              toolbar, then the pin next to Freighter.
            </p>
            <a className="btn btn-primary" href="https://www.freighter.app" target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", minHeight: 44 }}>
              Get Freighter <ExternalIcon />
            </a>
          </div>
        </li>
        <li style={step}>
          <span style={num} aria-hidden="true">2</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ fontSize: 17 }}>Create your wallet</h3>
            <p style={{ fontSize: 14.5, color: "var(--ink-2)" }}>
              Open Freighter, choose <strong>Create new wallet</strong>, and set a password.
            </p>
            <p className="note note-yellow">
              <span>
                <strong>Write the recovery phrase on paper and keep it private.</strong> Anyone with it can use your
                wallet, and It’s Your Sign can’t recover it for you.
              </span>
            </p>
          </div>
        </li>
        <li style={step}>
          <span style={num} aria-hidden="true">3</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ fontSize: 17 }}>Switch Freighter to Test Net</h3>
            <p style={{ fontSize: 14.5, color: "var(--ink-2)" }}>
              While It’s Your Sign is in beta, signing happens on a practice network — no real money involved. In
              Freighter, open <strong>Settings → Network</strong> and choose <strong>Test Net</strong>.
            </p>
          </div>
        </li>
      </ol>
      <div style={{ padding: "16px 28px 22px", borderTop: "1px solid var(--line-2)", background: "#FBFCFE", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <p className="muted" style={{ flex: 1, minWidth: 200, fontSize: 14 }}>
          All set? We’ll look for Freighter again — no need to reload.
        </p>
        <button type="button" className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            close();
            onCheckAgain();
          }}
        >
          <RetryIcon /> I’m done, check again
        </button>
      </div>
    </dialog>
  );
});
