"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusPage } from "@/components/StatusPage";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <StatusPage
      tone="error"
      eyebrow="Something went wrong"
      title={offline ? "You’re offline" : "This page didn’t load"}
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            Try again
          </button>
          <Link className="btn btn-secondary" href="/dashboard">
            Go to your documents
          </Link>
        </>
      }
    >
      <p>
        {offline
          ? "Check your connection, then try again."
          : "It’s on our side, not yours. Nothing you signed or sent was lost — anything already recorded on Stellar stays recorded."}
      </p>
      {digest && (
        <p className="help">
          If it keeps happening, send us this code: <code className="mono">{digest}</code>
        </p>
      )}
    </StatusPage>
  );
}
