import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  buildSignInMessage,
  decodeSignature,
  sep53Hash,
  verifySignedMessage,
} from "./auth-message";

// Signs exactly like Freighter: ed25519 over sha256("Stellar Signed Message:\n" + message).
function walletSign(kp: Keypair, message: string): Buffer {
  return Buffer.from(kp.sign(sep53Hash(message)));
}

const kp = Keypair.random();
const other = Keypair.random();
const message = buildSignInMessage({
  address: kp.publicKey(),
  nonce: "a1b2c3",
  origin: "https://itsyoursign.app",
});

describe("sign-in message", () => {
  it("names the account, website and code", () => {
    expect(message).toContain(kp.publicKey());
    expect(message).toContain("https://itsyoursign.app");
    expect(message).toContain("a1b2c3");
  });

  it("accepts the wallet's own signature in every shape wallets return", () => {
    const sig = walletSign(kp, message);
    expect(verifySignedMessage(kp.publicKey(), message, sig.toString("base64"))).toBe(true);
    expect(verifySignedMessage(kp.publicKey(), message, sig.toString("hex"))).toBe(true);
    expect(verifySignedMessage(kp.publicKey(), message, Array.from(sig))).toBe(true);
    expect(verifySignedMessage(kp.publicKey(), message, sig.toJSON())).toBe(true);
  });

  it("rejects another wallet's signature", () => {
    const sig = walletSign(other, message).toString("base64");
    expect(verifySignedMessage(kp.publicKey(), message, sig)).toBe(false);
  });

  it("rejects a signature over a different message (e.g. another code)", () => {
    const changed = message.replace("a1b2c3", "zzzzzz");
    const sig = walletSign(kp, changed).toString("base64");
    expect(verifySignedMessage(kp.publicKey(), message, sig)).toBe(false);
  });

  it("rejects a raw signature without the SEP-53 prefix", () => {
    const raw = Buffer.from(kp.sign(Buffer.from(message, "utf8"))).toString("base64");
    expect(verifySignedMessage(kp.publicKey(), message, raw)).toBe(false);
  });

  it("rejects junk input", () => {
    expect(verifySignedMessage("not-an-address", message, "abc")).toBe(false);
    expect(verifySignedMessage(kp.publicKey(), message, null)).toBe(false);
    expect(verifySignedMessage(kp.publicKey(), message, "short")).toBe(false);
    expect(decodeSignature({ nope: 1 })).toBeNull();
  });
});
