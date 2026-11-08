"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { initials, shortAddress } from "@/lib/format";

export function UserMenu({ name, wallet }: { name: string; wallet: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: "1px solid var(--line)",
          background: "var(--white)",
          borderRadius: 999,
          padding: "5px 12px 5px 5px",
          cursor: "pointer",
          font: "inherit",
          color: "var(--navy)",
          minHeight: 44,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--blue)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          {initials(name)}
        </span>
        <span style={{ textAlign: "left", lineHeight: 1.2 }}>
          <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{name}</span>
          <span className="mono" style={{ display: "block", fontSize: 11.5, color: "var(--ink-4)" }}>
            {shortAddress(wallet)}
          </span>
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="card"
          style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 220, padding: 8, zIndex: 10 }}
        >
          <p className="mono" style={{ fontSize: 12, color: "var(--ink-3)", padding: "6px 10px", wordBreak: "break-all" }}>
            {wallet}
          </p>
          <button
            type="button"
            role="menuitem"
            className="btn btn-ghost btn-block"
            style={{ justifyContent: "flex-start" }}
            onClick={signOut}
            disabled={busy}
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
