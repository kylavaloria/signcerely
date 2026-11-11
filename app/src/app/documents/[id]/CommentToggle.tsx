"use client";

import { useId, useState } from "react";

/** A "See comment" link that reveals a signer's or sender's note in place. */
export function CommentToggle({ comment }: { comment: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        style={{ border: 0, background: "none", padding: 0, font: "inherit", color: "var(--blue)", textDecoration: "underline", cursor: "pointer" }}
      >
        {open ? "Hide comment" : "See comment"}
      </button>
      {open && (
        <span id={id} style={{ display: "block", marginTop: 6, padding: "8px 12px", borderLeft: "3px solid var(--line)", color: "var(--ink-2)", background: "var(--mist)", borderRadius: 4 }}>
          “{comment}”
        </span>
      )}
    </>
  );
}
