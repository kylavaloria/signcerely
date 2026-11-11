"use client";

import { useEffect } from "react";

/** On narrow screens the tab row scrolls sideways; keep the selected tab visible. */
export function ActiveTabIntoView({ active }: { active: string }) {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".doc-tabs [aria-current='page']");
    const row = el?.parentElement;
    if (!el || !row || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2 - row.offsetLeft;
  }, [active]);
  return null;
}
