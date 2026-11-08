/**
 * Turn anything caught in the browser into a sentence a signer can act on.
 * Server-side errors arrive in production as a generic "Server Components
 * render" message, and dropped connections as "Failed to fetch" — neither
 * should reach the screen as-is.
 */
export function friendlyError(e: unknown, fallback = "Something went wrong on our side. Please try again."): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You’re offline. Check your connection, then try again.";
  }
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(msg)) {
    return "We couldn’t reach the server. Check your connection, then try again.";
  }
  if (/failed to find server action|older or newer deployment/i.test(msg)) {
    return "This page is out of date. Refresh it and try again.";
  }
  if (e instanceof TypeError || e instanceof ReferenceError) return fallback; // a bug, not something to show
  if (!msg || /server components render|omitted in production|digest/i.test(msg)) return fallback;
  return msg;
}

/** Let Next.js redirects and not-found signals through a catch block. */
export function rethrowNext(e: unknown): void {
  const d = (e as { digest?: unknown } | null)?.digest;
  if (typeof d === "string" && (d.startsWith("NEXT_REDIRECT") || d.startsWith("NEXT_HTTP_ERROR_FALLBACK") || d === "NEXT_NOT_FOUND")) {
    throw e;
  }
}
