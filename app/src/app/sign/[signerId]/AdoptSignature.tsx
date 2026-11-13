"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { canvasToBase64Png, signatureFromFile, trimCanvas } from "@/lib/signature-image";

export type Adopted = { pngBase64: string; dataUrl: string; kind: "drawn" | "uploaded"; saveToProfile: boolean };

type Props = {
  signerName: string;
  today: string;
  savedSignatureUrl: string | null;
  onAdopt: (a: Adopted) => void;
};

const tabStyle = (on: boolean): React.CSSProperties => ({
  flex: 1,
  minHeight: 44,
  border: 0,
  borderRadius: 9,
  font: "600 15px var(--font-body)",
  cursor: "pointer",
  background: on ? "#fff" : "transparent",
  color: on ? "var(--navy)" : "var(--ink-3)",
  boxShadow: on ? "0 1px 3px rgba(15,27,61,.12)" : "none",
});

/** "Add your signature" popup with Draw and Upload tabs. Open with ref.current.showModal(). */
export const AdoptSignature = forwardRef<HTMLDialogElement, Props>(function AdoptSignature(
  { signerName, today, savedSignatureUrl, onAdopt },
  ref,
) {
  const [tab, setTab] = useState<"draw" | "upload">("draw");
  const [drawn, setDrawn] = useState(false);
  const [uploaded, setUploaded] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [save, setSave] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pad = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  const close = () => (ref as React.RefObject<HTMLDialogElement | null>).current?.close();

  // Size the drawing pad to its box at device resolution once it's visible
  // (the dialog starts hidden, so watch for it to get a real size).
  useEffect(() => {
    const c = pad.current;
    if (!c || tab !== "draw") return;
    const fit = () => {
      const r = c.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);
      if (c.width === w && c.height === h) return;
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0F1B3D";
      ctx.lineWidth = 2.6;
      setDrawn(false);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    fit();
    return () => ro.disconnect();
  }, [tab]);

  const refreshPreview = useCallback(() => {
    const src = tab === "draw" ? (pad.current ? trimCanvas(pad.current) : null) : uploaded;
    setPreview(src ? src.toDataURL("image/png") : null);
  }, [tab, uploaded]);

  useEffect(() => {
    // Keep the "how it will look" preview in sync with the active tab.
     
    refreshPreview();
  }, [refreshPreview]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#0F1B3D";
    ctx.fill();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!last.current) return;
    const p = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    const mx = (last.current.x + p.x) / 2;
    const my = (last.current.y + p.y) / 2;
    ctx.quadraticCurveTo(last.current.x, last.current.y, mx, my);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setDrawn(true);
  }
  function up() {
    if (!last.current) return;
    last.current = null;
    setDrawn(true);
    refreshPreview();
  }
  function clear() {
    const c = pad.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setDrawn(false);
    setPreview(null);
  }

  async function onFile(f: File | undefined) {
    setError(null);
    if (!f) return;
    try {
      const c = await signatureFromFile(f);
      if (!c) throw new Error("We couldn’t find a signature in that image. Use a clear photo of dark ink on white paper.");
      setUploaded(c);
      setPreview(c.toDataURL("image/png"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function useSaved() {
    if (!savedSignatureUrl) return;
    setError(null);
    try {
      const blob = await (await fetch(savedSignatureUrl)).blob();
      const bmp = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext("2d")!.drawImage(bmp, 0, 0);
      onAdopt({ pngBase64: canvasToBase64Png(c), dataUrl: c.toDataURL("image/png"), kind: "drawn", saveToProfile: false });
      close();
    } catch {
      setError("Couldn’t load your saved signature. Draw or upload one instead.");
    }
  }

  function adopt() {
    const src = tab === "draw" ? (pad.current ? trimCanvas(pad.current) : null) : uploaded;
    if (!src) return setError(tab === "draw" ? "Draw your signature first." : "Choose an image first.");
    onAdopt({ pngBase64: canvasToBase64Png(src), dataUrl: src.toDataURL("image/png"), kind: tab === "draw" ? "drawn" : "uploaded", saveToProfile: save });
    close();
  }

  const ready = tab === "draw" ? drawn : Boolean(uploaded);

  return (
    <dialog ref={ref} className="modal" aria-labelledby="ad-t" style={{ width: "min(680px, calc(100vw - 24px))" }}>
      <div style={{ padding: "24px 28px 16px", display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 id="ad-t" className="h" style={{ fontSize: 26, fontWeight: 700 }}>
            Add your signature
          </h2>
          <p className="muted" style={{ fontSize: 15 }}>
            Signing as <strong style={{ color: "var(--navy)" }}>{signerName}</strong>. Draw it or upload a photo of it.
          </p>
        </div>
        <button type="button" aria-label="Close" className="btn btn-ghost" style={{ minHeight: 44, padding: "0 10px" }} onClick={close}>
          <CloseIcon />
        </button>
      </div>

      <div style={{ padding: "0 28px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {savedSignatureUrl && (
          <button type="button" className="btn btn-secondary btn-block" onClick={useSaved}>
            Use my saved signature
          </button>
        )}
        <div role="tablist" aria-label="How to add your signature" style={{ display: "flex", gap: 4, padding: 4, background: "var(--line-2)", borderRadius: 12 }}>
          <button type="button" role="tab" aria-selected={tab === "draw"} style={tabStyle(tab === "draw")} onClick={() => setTab("draw")}>
            Draw
          </button>
          <button type="button" role="tab" aria-selected={tab === "upload"} style={tabStyle(tab === "upload")} onClick={() => setTab("upload")}>
            Upload
          </button>
        </div>

        {tab === "draw" ? (
          <div role="tabpanel" aria-label="Draw" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ position: "relative", height: 190, border: "1.5px solid #C7D0EC", borderRadius: 14, background: "#fff" }}>
              <canvas
                ref={pad}
                aria-label="Signature drawing area. Draw with your mouse, finger or stylus."
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                style={{ width: "100%", height: "100%", touchAction: "none", cursor: "crosshair", display: "block", borderRadius: 14 }}
              />
              <span aria-hidden="true" style={{ position: "absolute", left: 40, right: 40, bottom: 44, borderTop: "1.5px solid #C7D0EC", pointerEvents: "none" }} />
              <button type="button" className="btn btn-ghost" onClick={clear} style={{ position: "absolute", top: 6, right: 6, minHeight: 40, padding: "0 12px", fontSize: 14 }}>
                Clear
              </button>
            </div>
            <p className="help">Use your mouse, trackpad, finger or a stylus. Sign above the line.</p>
          </div>
        ) : (
          <div role="tabpanel" aria-label="Upload" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label
              htmlFor="sig-file"
              style={{
                minHeight: 160,
                border: "1.5px dashed #AEBBE3",
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                backgroundColor: "#fff",
                backgroundImage:
                  "linear-gradient(45deg,#F2F4F9 25%,transparent 25%),linear-gradient(-45deg,#F2F4F9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#F2F4F9 75%),linear-gradient(-45deg,transparent 75%,#F2F4F9 75%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
                padding: 12,
              }}
            >
              {uploaded ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview ?? ""} alt="Your uploaded signature, background removed" style={{ maxWidth: "100%", maxHeight: 140 }} />
              ) : (
                <span className="btn btn-secondary" style={{ pointerEvents: "none" }}>
                  Choose a photo or scan
                </span>
              )}
            </label>
            <input id="sig-file" type="file" accept="image/png,image/jpeg" capture="environment" className="visually-hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <p className="help">
              Sign on plain white paper and take a clear photo. PNG or JPG. We remove the paper background.
              {uploaded && (
                <>
                  {" "}
                  <label htmlFor="sig-file" style={{ color: "var(--blue)", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>
                    Choose another
                  </label>
                </>
              )}
            </p>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p className="tag">How it will look on the document</p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "10px 24px", padding: "14px 18px", borderRadius: 12, background: "var(--mist)" }}>
            <div style={{ width: 240, maxWidth: "100%" }}>
              <div style={{ height: 64, display: "flex", alignItems: "flex-end" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview && <img src={preview} alt="" style={{ maxWidth: "100%", maxHeight: 60 }} />}
              </div>
              <p style={{ fontFamily: "Georgia, serif", fontSize: 13, borderTop: "1px solid #1C2440", paddingTop: 4 }}>Signed {today}</p>
            </div>
            <p className="help" style={{ flex: "1 1 160px" }}>
              The date is filled in for you when you finish signing.
            </p>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5, color: "var(--ink-2)", minHeight: 44, cursor: "pointer" }}>
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--blue)" }} />
          Save this signature to my profile for next time
        </label>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>

      <div style={{ padding: "14px 28px 20px", borderTop: "1px solid var(--line-2)", background: "#FBFCFE", display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <button type="button" className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={adopt} disabled={!ready}>
          Use this signature
        </button>
      </div>
    </dialog>
  );
});
