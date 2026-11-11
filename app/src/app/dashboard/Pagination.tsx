import Link from "next/link";

/** Page numbers to show, with null for "…": 1 2 3 … 10, 1 … 4 5 6 … 10, 1 … 8 9 10. */
export function pageList(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => keep.add(n));
  const nums = [...keep].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  keep,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  /** Other URL params the "Go to page" form must carry along. */
  keep: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <nav className="pager" aria-label="Pages">
      <p className="pager-summary" aria-live="polite">
        Showing {first} to {last} of {total} {total === 1 ? "result" : "results"}
      </p>
      {pages > 1 && (
        <div className="pager-controls">
          {page > 1 ? (
            <Link className="pager-btn" href={hrefFor(page - 1)} scroll={false} aria-label="Previous page">
              ‹
            </Link>
          ) : (
            <span className="pager-btn is-disabled" aria-hidden="true">
              ‹
            </span>
          )}
          {pageList(page, pages).map((n, i) =>
            n === null ? (
              <span key={`gap${i}`} className="pager-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={hrefFor(n)}
                scroll={false}
                className={`pager-btn${n === page ? " is-current" : ""}`}
                aria-current={n === page ? "page" : undefined}
                aria-label={`Page ${n}`}
              >
                {n}
              </Link>
            ),
          )}
          {page < pages ? (
            <Link className="pager-btn" href={hrefFor(page + 1)} scroll={false} aria-label="Next page">
              ›
            </Link>
          ) : (
            <span className="pager-btn is-disabled" aria-hidden="true">
              ›
            </span>
          )}
          <form className="pager-go" method="get" action="/dashboard">
            {Object.entries(keep).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <label htmlFor="pager-page">Go to page</label>
            <input id="pager-page" name="page" type="number" min={1} max={pages} defaultValue={page} inputMode="numeric" />
            <button type="submit">Go ›</button>
          </form>
        </div>
      )}
    </nav>
  );
}
