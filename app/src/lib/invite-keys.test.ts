import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  chainDocId,
  decryptSecret,
  encryptSecret,
  generateInviteKey,
  publicKeyFromSecret,
  signWithInvite,
} from "./invite-keys";

const KEY = "test-key-test-key-test-key-test-key-1234";

// Rebuild node KeyObjects from raw hex, the way the contract sees them.
const pubFromHex = (hex: string) =>
  createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(hex, "hex").toString("base64url") }, format: "jwk" });
const privFromHex = (secret: string, pub: string) =>
  createPrivateKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      d: Buffer.from(secret, "hex").toString("base64url"),
      x: Buffer.from(pub, "hex").toString("base64url"),
    },
    format: "jwk",
  });

describe("invite keys", () => {
  it("makes 32-byte ed25519 keys whose secret signs for the public key", () => {
    const k = generateInviteKey();
    expect(k.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(k.secretHex).toMatch(/^[0-9a-f]{64}$/);
    const msg = Buffer.from("its-your-sign:invite:v1 test");
    const sig = sign(null, msg, privFromHex(k.secretHex, k.publicKeyHex));
    expect(sig.length).toBe(64);
    expect(verify(null, msg, pubFromHex(k.publicKeyHex), sig)).toBe(true);
  });

  it("makes a different key every time", () => {
    expect(generateInviteKey().publicKeyHex).not.toBe(generateInviteKey().publicKeyHex);
  });

  it("round-trips the encrypted secret", () => {
    const { secretHex } = generateInviteKey();
    const blob = encryptSecret(secretHex, KEY);
    expect(blob.startsWith("v1.")).toBe(true);
    expect(blob).not.toContain(secretHex);
    expect(decryptSecret(blob, KEY)).toBe(secretHex);
  });

  it("refuses a wrong key or a tampered blob", () => {
    const blob = encryptSecret(generateInviteKey().secretHex, KEY);
    expect(() => decryptSecret(blob, KEY + "x")).toThrow();
    const parts = blob.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."), KEY)).toThrow();
  });

  it("refuses a missing or short encryption key", () => {
    expect(() => encryptSecret("ab", "short")).toThrow(/INVITE_ENCRYPTION_KEY/);
  });

  it("derives a stable 32-byte on-chain id from the document id", () => {
    const a = chainDocId("00000000-0000-0000-0000-000000000001");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(chainDocId("00000000-0000-0000-0000-000000000001")).toBe(a);
    expect(chainDocId("00000000-0000-0000-0000-000000000002")).not.toBe(a);
  });
});

describe("invite key helpers", () => {
  it("recovers the public key from the secret", () => {
    const k = generateInviteKey();
    expect(publicKeyFromSecret(k.secretHex)).toBe(k.publicKeyHex);
    expect(() => publicKeyFromSecret("zz")).toThrow();
  });
  it("makes deterministic proofs that verify with the public key", () => {
    const k = generateInviteKey();
    const msg = Buffer.from("hello");
    const p1 = signWithInvite(k.secretHex, msg);
    expect(p1).toBe(signWithInvite(k.secretHex, msg));
    expect(verify(null, msg, pubFromHex(k.publicKeyHex), Buffer.from(p1, "hex"))).toBe(true);
  });
});
