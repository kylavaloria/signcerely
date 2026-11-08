"use client";

import { useState, useTransition } from "react";
import { deleteDraft } from "./actions";

/** Two-click delete (no browser confirm dialog). */
export function DeleteDraftButton({ documentId }: { documentId: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  if (!armed) {
    return (
      <button type="button" className="btn btn-ghost" style={{ color: "var(--red-ink)" }} onClick={() => setArmed(true)}>
        Delete draft
      </button>
    );
  }
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }} role="group" aria-label="Confirm delete">
      <span className="help">Delete this draft and its file?</span>
      <button
        type="button"
        className="btn"
        style={{ background: "var(--red)", color: "#fff", minHeight: 40 }}
        disabled={pending}
        onClick={() => start(() => deleteDraft(documentId))}
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => setArmed(false)}>
        Keep it
      </button>
    </span>
  );
}
