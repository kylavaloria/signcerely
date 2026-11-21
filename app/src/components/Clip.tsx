"use client";

import { useEffect, useRef } from "react";

/**
 * A short, silent, looping screen recording (plays like a GIF but much smaller).
 * Doesn't autoplay for people who ask for reduced motion; they get controls instead.
 */
export function Clip({ name, label, width = 1280, height = 800 }: { name: string; label: string; width?: number; height?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      v.controls = true;
      return;
    }
    // Only play while on screen.
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <figure className="clip">
      <video
        ref={ref}
        src={`/clips/${name}.mp4`}
        poster={`/clips/${name}.jpg`}
        width={width}
        height={height}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={label}
      />
      <figcaption className="visually-hidden">{label}</figcaption>
    </figure>
  );
}
