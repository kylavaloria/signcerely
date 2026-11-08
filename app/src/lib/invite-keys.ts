import { createCipheriv, createDecipheriv, createHash, generateKeyPairSync, randomBytes } from "node:crypto";

/**
 * Invite keys (see contracts/signing): one ed25519 key per signing slot.
 * The public half is stored on-chain; the secret half goes in the invitee's
 * link and is kept here encrypted so the invite can be re-sent.
 */

export type InviteKey = { publicKeyHex: string; secretHex: string };

export function generateInviteKey(): InviteKey {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "jwk" });
  const priv = privateKey.export({ format: "jwk" });
  return {
    publicKeyHex: Buffer.from(pub.x!, "base64url").toString("hex"),
    secretHex: Buffer.from(priv.d!, "base64url").toString("hex"),
  };
}

function encryptionKey(raw = process.env.INVITE_ENCRYPTION_KEY): Buffer {
  if (!raw || raw.length < 32) {
    throw new Error("INVITE_ENCRYPTION_KEY is missing or too short. See .env.example.");
  }
  // Accept any string format; derive a fixed 32-byte AES key from it.
  return createHash("sha256").update(raw).digest();
}

/** AES-256-GCM. Output: "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encryptSecret(secretHex: string, rawKey?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(rawKey), iv);
  const ct = Buffer.concat([cipher.update(secretHex, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(blob: string, rawKey?: string): string {
  const [v, iv, tag, ct] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognized invite secret format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(rawKey), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

/** 32-byte id used on-chain for a document, derived from its database id. */
export function chainDocId(documentId: string): string {
  return createHash("sha256").update(`its-your-sign:doc:${documentId}`).digest("hex");
}
