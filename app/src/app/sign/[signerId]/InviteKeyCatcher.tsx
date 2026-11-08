"use client";

import { useEffect } from "react";

/**
 * Invite links end in #k=<invite secret>. Keep it for this tab only and tidy
 * the address bar so the secret isn't left on screen or in screenshots.
 */
export function InviteKeyCatcher({ signerId }: { signerId: string }) {
  useEffect(() => {
    const m = window.location.hash.match(/^#k=([0-9a-f]{64})$/);
    if (m) {
      try {
        sessionStorage.setItem(`iys-invite:${signerId}`, m[1]);
      } catch {
        // storage blocked: the link can simply be opened again
      }
      history.replaceState(null, "", window.location.pathname);
    }
  }, [signerId]);
  return null;
}
