"use client";

import {
  getNetworkDetails,
  isConnected,
  requestAccess,
  signMessage,
} from "@stellar/freighter-api";
import { networkPassphrase } from "./env";

/**
 * Thin wrapper around Freighter so the rest of the app doesn't depend on it
 * directly. Passkey wallets can plug in behind the same functions later.
 */

export type WalletError = { kind: "declined" | "not-installed" | "other"; message: string };

function toError(e: unknown): WalletError {
  const msg =
    typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/declin|reject|denied|cancel/i.test(msg)) {
    return { kind: "declined", message: "The request was declined in Freighter." };
  }
  return { kind: "other", message: msg || "Something went wrong with Freighter." };
}

export async function hasFreighter(): Promise<boolean> {
  try {
    const res = await isConnected();
    return Boolean(res?.isConnected);
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<{ address: string } | { error: WalletError }> {
  if (!(await hasFreighter())) {
    return { error: { kind: "not-installed", message: "Freighter isn't installed." } };
  }
  const res = await requestAccess();
  if (res.error || !res.address) return { error: toError(res.error ?? "No address returned.") };
  return { address: res.address };
}

/** Is Freighter set to the network this app uses? */
export async function isOnAppNetwork(): Promise<boolean> {
  try {
    const details = await getNetworkDetails();
    return details?.networkPassphrase === networkPassphrase;
  } catch {
    return false;
  }
}

function toBase64(sig: unknown): string | null {
  if (typeof sig === "string") return sig;
  if (sig instanceof Uint8Array) return btoa(String.fromCharCode(...sig));
  if (sig && typeof sig === "object") {
    const data = "data" in sig ? (sig as { data: unknown }).data : Object.values(sig);
    if (Array.isArray(data)) return btoa(String.fromCharCode(...(data as number[])));
  }
  return null;
}

/** Sign a plain-text message (SEP-53). Returns the signature as base64. */
export async function signText(
  message: string,
  address: string,
): Promise<{ signature: string } | { error: WalletError }> {
  try {
    const res = await signMessage(message, { address, networkPassphrase });
    if (res.error) return { error: toError(res.error) };
    if (res.signerAddress && res.signerAddress !== address) {
      return {
        error: { kind: "other", message: "Freighter signed with a different account. Switch back and try again." },
      };
    }
    const signature = toBase64(res.signedMessage);
    if (!signature) return { error: { kind: "other", message: "Freighter didn't return a signature." } };
    return { signature };
  } catch (e) {
    return { error: toError(e) };
  }
}
