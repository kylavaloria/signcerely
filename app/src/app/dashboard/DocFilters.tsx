"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Title search + "Sent by" filter. Both live in the URL so links and refreshes keep them. */
export function DocFilters({ senders }: { senders: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const from = params.get("from") ?? "";
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (next: { q?: string; from?: string }) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page"); // a new filter starts from page 1
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="doc-filters" role="search">
      <div className="doc-search">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <label htmlFor="doc-q" className="visually-hidden">
          Search by document title
        </label>
        <input
          id="doc-q"
          type="search"
          placeholder="Search by document title"
          value={q}
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => push({ q: v.trim() }), 300);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (timer.current) clearTimeout(timer.current);
              push({ q: q.trim() });
            }
          }}
        />
      </div>
      <div className="doc-sender">
        <label htmlFor="doc-from">Sent by</label>
        <select id="doc-from" className="input" value={from} onChange={(e) => push({ from: e.target.value })}>
          <option value="">Anyone</option>
          {senders.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
