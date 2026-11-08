"use client";

import { useActionState } from "react";
import { AlertIcon, ArrowRight, MailIcon, Spinner } from "@/components/icons";
import { saveProfile, type ProfileFormState } from "./actions";

type Props = {
  defaults: { fullName: string; email: string };
  invite: { invitedBy: string | null; invitedAs: string } | null;
  next?: string | null;
};

export function ProfileForm({ defaults, invite, next }: Props) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const values = state.values ?? defaults;
  const e = state.errors ?? {};

  return (
    <form action={action} noValidate style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {next && <input type="hidden" name="next" value={next} />}
      {invite && (
        <p className="note note-yellow">
          <MailIcon color="#0F1B3D" />
          <span>
            <strong>
              {invite.invitedBy ? `${invite.invitedBy} invited you` : "You were invited"} as “{invite.invitedAs}.”
            </strong>{" "}
            We filled that in below — change it if it’s not how your name should appear.
          </span>
        </p>
      )}

      <div className="field">
        <label className="label" htmlFor="fullName">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          className="input"
          type="text"
          autoComplete="name"
          required
          defaultValue={values.fullName}
          aria-invalid={Boolean(e.fullName)}
          aria-describedby="fullName-help"
        />
        {e.fullName ? (
          <p id="fullName-help" className="error-text">{e.fullName}</p>
        ) : (
          <p id="fullName-help" className="help">
            Shown on every document you sign, next to your email and wallet address.
          </p>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="email">
          Email for signature updates
        </label>
        <input
          id="email"
          name="email"
          className="input"
          type="email"
          autoComplete="email"
          required
          defaultValue={values.email}
          aria-invalid={Boolean(e.email)}
          aria-describedby="email-help"
        />
        {e.email ? (
          <p id="email-help" className="error-text">{e.email}</p>
        ) : (
          <p id="email-help" className="help">
            We’ll use this to tell you when it’s your turn to sign. No newsletters.
          </p>
        )}
      </div>

      {e.form && (
        <p className="note note-red" role="alert">
          <AlertIcon />
          <span>{e.form}</span>
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, borderTop: "1px solid var(--line-2)", paddingTop: 20 }}>
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending} aria-busy={pending}>
          {pending ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            <>
              Continue <ArrowRight />
            </>
          )}
        </button>
        <p className="help" style={{ textAlign: "center" }}>
          You can change your name later in Settings.
        </p>
      </div>
    </form>
  );
}
