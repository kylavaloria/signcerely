"use client";

/** Turning drawings and photos into clean, transparent signature PNGs. */

const MAX_W = 900;
const MAX_H = 300;

/** Crop a canvas to its non-transparent pixels (plus padding). Null if empty. */
export function trimCanvas(src: HTMLCanvasElement, pad = 8): HTMLCanvasElement | null {
  const ctx = src.getContext("2d")!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let top = height,
    left = width,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);
  const w = right - left + 1;
  const h = bottom - top + 1;
  const scale = Math.min(1, MAX_W / w, MAX_H / h);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w * scale));
  out.height = Math.max(1, Math.round(h * scale));
  out.getContext("2d")!.drawImage(src, left, top, w, h, 0, 0, out.width, out.height);
  return out;
}

/**
 * Remove a light paper background from a photo or scan: pixels lighter than
 * the threshold become transparent, darker ones become solid ink.
 */
export function removeBackground(canvas: HTMLCanvasElement, ink = "#14264F"): void {
  const ctx = canvas.getContext("2d")!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  // Estimate the paper brightness from the image itself (bright percentile).
  const lum: number[] = [];
  for (let i = 0; i < d.length; i += 16) lum.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  lum.sort((a, b) => a - b);
  const paper = lum[Math.floor(lum.length * 0.9)] ?? 255;
  const cut = Math.min(200, paper - 45);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
  for (let i = 0; i < d.length; i += 4) {
    const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (d[i + 3] < 16 || L >= cut) {
      d[i + 3] = 0;
    } else {
      // Darker pixels are more opaque, so edges stay smooth.
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = Math.round(255 * Math.min(1, (cut - L) / 60));
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Load an uploaded image file and turn it into a cleaned-up signature canvas. */
export async function signatureFromFile(file: File): Promise<HTMLCanvasElement | null> {
  if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error("Use a PNG or JPG image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("That image is over 5 MB. Try a smaller photo.");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bmp.width, 1600 / bmp.height);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  removeBackground(c);
  return trimCanvas(c, 6);
}

/** PNG bytes as base64 (no data: prefix). */
export function canvasToBase64Png(c: HTMLCanvasElement): string {
  return c.toDataURL("image/png").split(",")[1];
}
