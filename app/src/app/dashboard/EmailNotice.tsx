"use client";

import { useActionState } from "react";
import { AlertIcon, InfoIcon, Spinner } from "@/components/icons";
import { resendConfirmation, type ResendState } from "./actions";

export function EmailNotice({ email, justSent }: { email: string; justSent: "sent" | "failed" | null }) {
  const [state, action, pending] = useActionState<ResendState>(resendConfirmation, { status: "idle" });
  const failed = state.status === "error" || (state.status === "idle" && justSent === "failed");

  return (
    <div
      className={failed ? "note note-red" : "note"}
      role={failed ? "alert" : "status"}
      style={failed ? { alignItems: "center" } : { background: "#fff", border: "1px solid var(--line)", alignItems: "center" }}
    >
      {failed ? <AlertIcon /> : <InfoIcon />}
      <span style={{ flex: 1 }}>
        {state.message ??
          (justSent === "failed" ? (
            <>We couldn’t send the confirmation email to <strong>{email}</strong>.</>
          ) : (
            <>
              Confirm <strong>{email}</strong> so we can send you signing updates.{" "}
              {justSent === "sent" && "We just sent you a link."}
            </>
          ))}
      </span>
      <form action={action}>
        <button type="submit" className="btn btn-secondary" style={{ minHeight: 40, padding: "0 14px", fontSize: 14 }} disabled={pending}>
          {pending ? <Spinner size={16} /> : null} Send again
        </button>
      </form>
    </div>
  );
}
