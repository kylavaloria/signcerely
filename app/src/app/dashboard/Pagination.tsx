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
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
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
          <button type="button" className={`pager-btn${page > 1 ? "" : " is-disabled"}`} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
            ‹
          </button>
          {pageList(page, pages).map((n, i) =>
            n === null ? (
              <span key={`gap${i}`} className="pager-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onPage(n)}
                className={`pager-btn${n === page ? " is-current" : ""}`}
                aria-current={n === page ? "page" : undefined}
                aria-label={`Page ${n}`}
              >
                {n}
              </button>
            ),
          )}
          <button type="button" className={`pager-btn${page < pages ? "" : " is-disabled"}`} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
            ›
          </button>
          <form
            className="pager-go"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Math.floor(Number(new FormData(e.currentTarget).get("page")));
              if (n >= 1) onPage(Math.min(pages, n));
            }}
          >
            <label htmlFor="pager-page">Go to page</label>
            <input key={page} id="pager-page" name="page" type="number" min={1} max={pages} defaultValue={page} inputMode="numeric" />
            <button type="submit">Go ›</button>
          </form>
        </div>
      )}
    </nav>
  );
}
