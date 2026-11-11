"use client";

import { useEffect, useRef } from "react";

/**
 * Fades and slides its content in the first time it scrolls into view.
 * Content is visible by default: it is only hidden once this script has run
 * and the element is still below the screen, so nothing can get stuck hidden.
 */
export function Reveal({
  children,
  as = "div",
  from = "up",
  delay = 0,
  className,
  style,
}: {
  children: React.ReactNode;
  as?: "div" | "li" | "section";
  from?: "up" | "left" | "right" | "scale" | "pixels";
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // already on screen
    el.classList.add("reveal-armed");

    // "pixels": cover the element with coloured blocks that pop away at random.
    let cover: HTMLDivElement | null = null;
    if (from === "pixels") {
      const cols = 12;
      const rows = Math.max(4, Math.round((el.offsetHeight / Math.max(1, el.offsetWidth)) * cols));
      cover = document.createElement("div");
      cover.className = "pixel-cover";
      cover.setAttribute("aria-hidden", "true");
      cover.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      cover.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      const colors = ["#4a9bf0", "#1f6fd6", "#9cc8f7", "#ffdd1f", "#ffffff", "#4a9bf0", "#9cc8f7"];
      for (let i = 0; i < cols * rows; i++) {
        const t = document.createElement("i");
        t.style.background = colors[Math.floor(Math.random() * colors.length)];
        t.style.transitionDelay = `${delay + Math.round(Math.random() * 620)}ms`;
        cover.appendChild(t);
      }
      el.appendChild(cover);
    }
    let cleanup: ReturnType<typeof setTimeout> | undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("reveal-in");
        if (cover) cleanup = setTimeout(() => cover?.remove(), delay + 1300);
        io.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (cleanup) clearTimeout(cleanup);
      cover?.remove();
    };
  }, [from, delay]);

  const Tag = as as "div";
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`reveal reveal-${from}${className ? ` ${className}` : ""}`}
      style={{ ...style, ["--d" as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
