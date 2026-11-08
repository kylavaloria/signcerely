"use client";

import "./globals.css";

/** Last-resort screen if the root layout itself fails. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong · It&apos;s Your Sign</title>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 className="h" style={{ fontSize: 32, fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p className="muted">It’s on our side. Anything already recorded on Stellar stays recorded.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => retry()}>
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="btn btn-secondary" href="/">
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
