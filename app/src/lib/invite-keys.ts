import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";

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
  return createHash("sha256").update(`signcerely:doc:${documentId}`).digest("hex");
}

function privateKeyFromSeed(secretHex: string) {
  // PKCS#8 wrapper for a raw 32-byte Ed25519 seed.
  const der = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secretHex, "hex")]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

/** Public half (hex) for an invite secret, to check a link's key. */
export function publicKeyFromSecret(secretHex: string): string {
  if (!/^[0-9a-f]{64}$/.test(secretHex)) throw new Error("Bad invite key.");
  const jwk = createPublicKey(privateKeyFromSeed(secretHex)).export({ format: "jwk" });
  return Buffer.from(jwk.x!, "base64url").toString("hex");
}

/** Ed25519 signature (hex) over `message` with the invite secret: the contract's invite proof. */
export function signWithInvite(secretHex: string, message: Uint8Array): string {
  return sign(null, Buffer.from(message), privateKeyFromSeed(secretHex)).toString("hex");
}
