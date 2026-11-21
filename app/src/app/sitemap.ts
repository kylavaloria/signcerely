import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Public pages only. Invites, documents and account pages are private and marked noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/verify`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/sign-in`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
