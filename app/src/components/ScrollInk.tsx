"use client";

import { useEffect, useRef, useState } from "react";

/** Waypoints of the ink line as fractions of the container (x, y). */
const POINTS: [number, number][] = [
  [0.62, 0.05],
  [0.93, 0.1],
  [0.5, 0.17],
  [0.04, 0.24],
  [0.5, 0.31],
  [0.96, 0.4],
  [0.52, 0.48],
  [0.05, 0.57],
  [0.5, 0.66],
  [0.95, 0.74],
  [0.6, 0.82],
  [0.3, 0.88],
];

/**
 * A signature-like ink line behind the page that draws itself as you scroll
 * and finishes with a check mark. Decorative only.
 */
export function ScrollInk() {
  const svg = useRef<SVGSVGElement>(null);
  const line = useRef<SVGPathElement>(null);
  const check = useRef<SVGPathElement>(null);
  const [size, setSize] = useState<{ w: number; h: number; end: number } | null>(null);

  useEffect(() => {
    const host = svg.current?.parentElement;
    if (!host) return;
    const measure = () => {
      // Finish just above the closing banner so the check stays in view.
      const band = host.querySelector<HTMLElement>(".cta-band");
      const hostTop = host.getBoundingClientRect().top;
      const end = band ? band.getBoundingClientRect().top - hostTop - 46 : host.scrollHeight * 0.88;
      setSize({ w: host.clientWidth, h: host.scrollHeight, end });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const path = line.current;
    const tick = check.current;
    const host = svg.current?.parentElement;
    if (!path || !tick || !host || !size) return;
    const total = path.getTotalLength();
    const tickLen = tick.getTotalLength();
    path.style.strokeDasharray = `${total}`;
    tick.style.strokeDasharray = `${tickLen}`;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const draw = () => {
      raf = 0;
      const top = host.getBoundingClientRect().top + window.scrollY;
      const raw = (window.scrollY + window.innerHeight * 0.72 - top) / size.end;
      const p = still ? 1 : Math.min(1, Math.max(0, raw));
      path.style.strokeDashoffset = `${total * (1 - p)}`;
      // The check is drawn over the last stretch of the scroll.
      const c = Math.min(1, Math.max(0, (p - 0.94) / 0.06));
      tick.style.strokeDashoffset = `${tickLen * (1 - c)}`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [size]);

  let d = "";
  let checkD = "";
  if (size) {
    const lastY = POINTS[POINTS.length - 1][1];
    const pts = POINTS.map(([x, y]) => [x * size.w, (y / lastY) * size.end] as const);
    d = `M ${pts[0][0]} ${pts[0][1]}`;
    // Smooth curve through the midpoints, like a pen that never lifts.
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q ${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
    }
    const [ex, ey] = pts[pts.length - 1];
    d += ` L ${ex} ${ey}`;
    checkD = `M ${ex} ${ey} l 22 24 l 46 -62`;
  }

  return (
    <svg ref={svg} aria-hidden="true" className="scroll-ink" width={size?.w ?? 0} height={size?.h ?? 0} viewBox={`0 0 ${size?.w ?? 1} ${size?.h ?? 1}`}>
      <defs>
        <linearGradient id="ink-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6BB3F7" />
          <stop offset="1" stopColor="#1F6FD6" />
        </linearGradient>
      </defs>
      <path ref={line} d={d} fill="none" stroke="url(#ink-g)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path ref={check} d={checkD} fill="none" stroke="#FFDD1F" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
