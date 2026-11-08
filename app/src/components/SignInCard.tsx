"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { shortAddress } from "@/lib/format";
import { WALLET_URL, connectWallet, hasWallet, isOnAppNetwork, signText } from "@/lib/wallet";
import { WalletGuide } from "./WalletGuide";
import { AlertIcon, ArrowRight, CheckIcon, ExternalIcon, InfoIcon, Spinner, WalletIcon } from "./icons";

type State =
  | { step: "checking" }
  | { step: "no-wallet" }
  | { step: "ready" }
  | { step: "connecting" }
  | { step: "connected"; address: string; wrongNetwork: boolean }
  | { step: "signing"; address: string };

export function SignInCard() {
  const router = useRouter();
  const guide = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ step: "checking" });
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setError(null);
    setState({ step: "checking" });
    setState((await hasWallet()) ? { step: "ready" } : { step: "no-wallet" });
  }, []);

  useEffect(() => {
    // Detect the wallet after mount (it injects into the page).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
  }, [check]);

  // Coming back to this tab after installing or unlocking the wallet: look again.
  useEffect(() => {
    if (state.step !== "no-wallet") return;
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [state.step, check]);

  async function connect() {
    setError(null);
    setState({ step: "connecting" });
    const res = await connectWallet();
    if ("error" in res) {
      if (res.error.kind === "not-installed") return setState({ step: "no-wallet" });
      setError(
        res.error.kind === "declined"
          ? "The connection was declined. Nothing was shared — try again and choose Approve in Varial."
          : res.error.message,
      );
      return setState({ step: "ready" });
    }
    setState({ step: "connected", address: res.address, wrongNetwork: !(await isOnAppNetwork()) });
  }

  async function continueSignIn(address: string) {
    setError(null);
    setState({ step: "signing", address });
    try {
      const ch = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const challenge = await ch.json();
      if (!ch.ok) throw new Error(challenge.error ?? "Couldn't start sign-in.");

      const signed = await signText(challenge.message, address);
      if ("error" in signed) {
        throw new Error(
          signed.error.kind === "declined"
            ? "Sign-in was declined in Varial. Try again and choose Approve — it doesn't cost anything."
            : signed.error.message,
        );
      }

      const v = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, nonce: challenge.nonce, signature: signed.signature }),
      });
      const verified = await v.json();
      if (!v.ok) throw new Error(verified.error ?? "Couldn't finish sign-in.");
      router.push(verified.next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState({ step: "connected", address, wrongNetwork: !(await isOnAppNetwork()) });
    }
  }

  return (
    <section className="card" aria-labelledby="si-title" style={{ padding: "clamp(24px, 5vw, 40px)", display: "flex", flexDirection: "column", gap: 24 }}>
      <WalletGuide ref={guide} onCheckAgain={check} />

      {state.step === "no-wallet" ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 id="si-title" className="h" style={{ fontSize: 28, fontWeight: 700 }}>
              Let’s get Varial first
            </h2>
            <p className="muted">
              Varial (formerly Freighter) is a free Stellar wallet extension that lets you sign securely. Setup takes about two minutes.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <a className="btn btn-primary btn-lg btn-block" href={WALLET_URL} target="_blank" rel="noopener noreferrer">
              Install Varial <ExternalIcon />
            </a>
            <button type="button" className="btn btn-secondary btn-block" onClick={check}>
              I’ve installed it
            </button>
            <p className="help" style={{ textAlign: "center" }}>
              Already have it? Unlock Varial, then refresh this page.
            </p>
            <p className="help" style={{ textAlign: "center" }}>
              New to wallets?{" "}
              <button type="button" onClick={() => guide.current?.showModal()} style={linkButton}>
                Show me how
              </button>
            </p>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 id="si-title" className="h" style={{ fontSize: 30, fontWeight: 700 }}>
              Sign in
            </h2>
            <p className="muted">Connect your wallet, then continue to your agreements.</p>
          </div>

          {(state.step === "checking" || state.step === "ready" || state.step === "connecting") && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-lg btn-block"
                  onClick={connect}
                  disabled={state.step !== "ready"}
                  aria-busy={state.step !== "ready"}
                >
                  {state.step === "ready" ? <WalletIcon /> : <Spinner />}
                  {state.step === "connecting"
                    ? "Waiting for Varial…"
                    : state.step === "checking"
                      ? "Looking for your wallet…"
                      : "Connect Varial wallet"}
                </button>
                <p className="help" style={{ textAlign: "center" }}>
                  New to Varial?{" "}
                  <button type="button" onClick={() => guide.current?.showModal()} style={linkButton}>
                    See how to set it up
                  </button>
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button type="button" className="btn btn-lg btn-block" disabled aria-describedby="si-wait">
                  Continue
                </button>
                <p id="si-wait" className="help" style={{ textAlign: "center" }}>
                  Connect your wallet first, then continue.
                </p>
              </div>
            </>
          )}

          {(state.step === "connected" || state.step === "signing") && (
            <>
              <div className="note note-green" role="status" style={{ alignItems: "center" }}>
                <CheckIcon color="#1F9D61" />
                <span style={{ flex: 1 }}>
                  <strong style={{ display: "block" }}>Varial connected</strong>
                  <span className="mono" style={{ fontSize: 13, color: "var(--ink-2)" }}>
                    {shortAddress(state.address)}
                  </span>
                </span>
                <button type="button" onClick={connect} disabled={state.step === "signing"} style={linkButton}>
                  Change
                </button>
              </div>
              {state.step === "connected" && state.wrongNetwork && (
                <p className="note note-yellow">
                  <InfoIcon color="#0F1B3D" />
                  <span>
                    Varial isn’t on <strong>Test Net</strong>. You can sign in, but switch it in Varial’s{" "}
                    <strong>Settings → Network</strong> before signing documents.
                  </span>
                </p>
              )}
              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                onClick={() => continueSignIn(state.address)}
                disabled={state.step === "signing"}
                aria-busy={state.step === "signing"}
              >
                {state.step === "signing" ? (
                  <>
                    <Spinner /> Approve in Varial…
                  </>
                ) : (
                  <>
                    Continue <ArrowRight />
                  </>
                )}
              </button>
              {state.step === "signing" && (
                <p className="help" style={{ textAlign: "center" }}>
                  Varial will ask you to sign a short message. It doesn’t send a transaction or cost anything.
                </p>
              )}
            </>
          )}
        </>
      )}

      {error && (
        <p className="note note-red" role="alert">
          <AlertIcon />
          <span>{error}</span>
        </p>
      )}

      <p style={{ fontSize: 13, color: "var(--ink-3)", borderTop: "1px solid var(--line-2)", paddingTop: 20 }}>
        By continuing, you agree to the Terms of use and Privacy policy.
      </p>
    </section>
  );
}

const linkButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  padding: 0,
  font: "inherit",
  fontWeight: 600,
  color: "var(--blue)",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  cursor: "pointer",
};
