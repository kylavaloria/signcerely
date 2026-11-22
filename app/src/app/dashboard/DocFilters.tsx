"use client";

/** Title search + "Sent by" filter. Filtering happens in the browser, so it's instant. */
export function DocFilters({
  senders,
  q,
  from,
  onQ,
  onFrom,
}: {
  senders: { value: string; label: string }[];
  q: string;
  from: string;
  onQ: (q: string) => void;
  onFrom: (from: string) => void;
}) {
  return (
    <div className="doc-filters" role="search" onSubmit={(e) => e.preventDefault()}>
      <div className="doc-search">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <label htmlFor="doc-q" className="visually-hidden">
          Search by document title
        </label>
        <input id="doc-q" type="search" placeholder="Search by document title" value={q} onChange={(e) => onQ(e.target.value)} />
      </div>
      <div className="doc-sender">
        <label htmlFor="doc-from">Sent by</label>
        <select id="doc-from" className="input" value={from} onChange={(e) => onFrom(e.target.value)}>
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
