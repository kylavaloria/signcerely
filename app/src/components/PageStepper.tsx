"use client";

import { useId, useState } from "react";

/**
 * "Page [ 3 ] of 11" with a typeable box and up/down arrows.
 * Arrows move like scrolling the document: up goes to the previous page, down to the next one.
 */
export function PageStepper({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const id = useId();
  // What the person is typing; null means "show the current page".
  const [draft, setDraft] = useState<string | null>(null);

  const go = (p: number) => {
    const next = Math.min(pageCount, Math.max(1, Math.round(p)));
    setDraft(null);
    if (next !== page) onChange(next);
  };
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n)) setDraft(null);
    else go(n);
  };

  return (
    <div className="page-stepper">
      <label htmlFor={id}>Page</label>
      <div className="page-stepper-field">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft ?? String(page)}
          aria-describedby={`${id}-of`}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "ArrowUp") {
              e.preventDefault();
              go(page - 1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              go(page + 1);
            }
          }}
        />
        <span className="page-stepper-arrows">
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 7.5 6 4.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => go(page + 1)}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </span>
      </div>
      <span id={`${id}-of`} aria-live="polite">
        of {pageCount}
      </span>
    </div>
  );
}
