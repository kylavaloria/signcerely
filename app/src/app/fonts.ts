import localFont from "next/font/local";

// Self-hosted brand fonts (SIL Open Font License, see fonts/LICENSE-*.txt).
// Loaded through next/font so they are preloaded and don't block the first paint.

export const bricolage = localFont({
  src: "./fonts/bricolage-grotesque.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

export const jakarta = localFont({
  src: [
    { path: "./fonts/plus-jakarta-sans.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-italic.woff2", weight: "200 800", style: "italic" },
  ],
  variable: "--font-jakarta",
  display: "swap",
});

export const jetbrains = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  weight: "100 800",
  variable: "--font-jetbrains",
  display: "swap",
});
