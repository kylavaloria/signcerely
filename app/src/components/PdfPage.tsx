"use client";

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

/**
 * Renders one PDF page to a canvas that fills its container's width.
 * Reports the page's aspect ratio (height / width) once known.
 */
export function PdfPage({
  pdf,
  pageNumber,
  onAspect,
  label,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  onAspect?: (ratio: number) => void;
  label?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [ratio, setRatio] = useState(1.294); // A4-ish until the page loads

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !canvas.current) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      const r = base.height / base.width;
      setRatio(r);
      onAspect?.(r);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      const c = canvas.current;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      task = page.render({ canvas: c, viewport });
      await task.promise.catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, width, onAspect]);

  return (
    <div ref={wrap} style={{ width: "100%", position: "relative", aspectRatio: `1 / ${ratio}` }}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={label ?? `Page ${pageNumber}`}
        style={{ width: "100%", height: "100%", display: "block", background: "#fff" }}
      />
    </div>
  );
}
