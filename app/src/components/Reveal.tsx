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
  from?: "up" | "left" | "right" | "scale";
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
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("reveal-in");
        io.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

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
