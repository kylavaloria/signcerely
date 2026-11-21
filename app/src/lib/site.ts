import type { Metadata } from "next";

/** Public address of the site, for canonical links, the sitemap and link previews. */
export const SITE_URL = (process.env.APP_URL || "https://signcerely.site").replace(/\/$/, "");

export const SITE_TITLE = "Signcerely – Sign PDFs online and prove who signed";

export const SITE_DESCRIPTION =
  "Send a PDF, choose who signs and in what order, and get a signed copy anyone can check. No account needed to verify.";

/** For private pages (invites, documents, account steps): keep them out of search results. */
export const noIndex: Metadata["robots"] = { index: false, follow: false };

/**
 * Metadata for a public page: title, description, canonical link and a link
 * preview. Setting openGraph/twitter replaces the site-wide ones, so the
 * preview image is listed again.
 */
export function pageMeta(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, images: ["/opengraph-image.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/twitter-image.png"] },
  };
}

/** Where people send privacy requests and questions about the Terms. */
export const CONTACT_EMAIL = "concerns@signcerely.site";

/** "Last updated" date shown on the Privacy Policy and Terms. */
export const LEGAL_UPDATED = "November 22, 2026";
