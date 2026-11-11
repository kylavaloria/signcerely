"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, PixelArt } from "./Decor";

const STEPS = [
  {
    title: "Upload and invite",
    text: "Add a PDF, choose who signs, and decide if they sign one after another or all at once.",
  },
  {
    title: "Everyone signs",
    text: "Each person gets an email when it’s their turn, adds their signature, and approves in their wallet.",
  },
  {
    title: "Anyone can check it",
    text: "Download the signed copy. Anyone can confirm who signed and that nothing changed. No account needed.",
  },
];

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * "How it works" told by scrolling: the section pins to the screen and one
 * document goes through upload, signing and checking as you scroll. Scroll
 * position drives everything, so it also plays backwards.
 */
export function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // CSS shows the finished state
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - window.innerHeight));
      const seg = p * 3;
      // Step 1 plays while the section scrolls into place, so the paper is there once it pins.
      el.style.setProperty("--s1", String(clamp((window.innerHeight * 0.85 - r.top) / (window.innerHeight * 0.85))));
      el.style.setProperty("--s2", String(clamp(seg - 0.75)));
      el.style.setProperty("--s3", String(clamp(seg - 1.85)));
      setStep(seg < 0.75 ? 0 : seg < 1.85 ? 1 : 2);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="story" data-step={step}>
      <div className="story-pin">
        <div className="story-copy">
          <p className="tag" style={{ color: "var(--blue)" }}>
            How it works
          </p>
          <ol className="story-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} data-active={i === step}>
                <span className="story-num">{i + 1}</span>
                <div>
                  <h3 className="h">{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* The document that the story happens to. Decorative: the steps beside it carry the meaning. */}
        <div className="story-stage" aria-hidden="true">
          <div className="story-orb" />
          <div className="paper">
            <div className="paper-head">
              <span className="paper-logo" />
              <span className="bar" style={{ width: "52%" }} />
            </div>
            <span className="bar" style={{ width: "92%" }} />
            <span className="bar" style={{ width: "84%" }} />
            <span className="bar" style={{ width: "88%" }} />
            <span className="bar" style={{ width: "60%" }} />
            <span className="bar" style={{ width: "90%", marginTop: 10 }} />
            <span className="bar" style={{ width: "72%" }} />

            <div className="paper-signs">
              <div className="sign-slot one">
                <svg viewBox="0 0 120 44">
                  <path d="M6 32c8-16 16-26 21-24 6 3-6 22 0 23 6 1 11-14 17-12 4 1 0 9 4 10 6 1 9-12 15-12 5 0 2 10 8 10 7 0 10-9 18-9 6 0 6 5 14 4" pathLength={1} />
                </svg>
                <b>Lea Santos</b>
                <small>Signed Nov 3, 2026</small>
              </div>
              <div className="sign-slot two">
                <svg viewBox="0 0 120 44">
                  <path d="M8 30c4-10 10-20 16-20 8 0 2 22 9 22 8 0 8-24 16-24 7 0 3 20 10 20 6 0 8-12 14-12 6 0 5 10 12 10 8 0 12-6 26-8" pathLength={1} />
                </svg>
                <b>Miguel Tan</b>
                <small>Signed Nov 4, 2026</small>
              </div>
            </div>

            <div className="paper-result">
              <span className="tick">✓</span>
              <span>
                <b>This document matches the signed version</b>
                <small>Fingerprint 9f2c…a71e · unchanged</small>
              </span>
            </div>
            <span className="paper-stamp">Verified</span>
          </div>

          <span className="story-chip chip-a">
            <PixelArt name="mail" pixel={2.4} /> Lea Santos
          </span>
          <span className="story-chip chip-b">
            <PixelArt name="mail" pixel={2.4} /> Miguel Tan
          </span>
          <span className="story-lens">
            <Badge name="magnifier" size={76} pixel={4} tone="yellow" />
          </span>
        </div>
      </div>
    </div>
  );
}
