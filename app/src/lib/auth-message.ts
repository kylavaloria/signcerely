import { Keypair, StrKey, hash } from "@stellar/stellar-sdk";

/** SEP-53 prefix that Varial/Freighter (and other Stellar wallets) add before signing. */
export const SEP53_PREFIX = "Stellar Signed Message:\n";

/** The text the user sees in their wallet when signing in. Rebuilt on the server to verify. */
export function buildSignInMessage(input: { address: string; nonce: string; origin: string }): string {
  return [
    "It's Your Sign — sign in",
    "",
    `Account: ${input.address}`,
    `Website: ${input.origin}`,
    `Code: ${input.nonce}`,
    "",
    "This only proves you own this wallet. It doesn't send a transaction or cost anything.",
  ].join("\n");
}

/** sha256(prefix + message), the bytes a SEP-53 signature covers. */
export function sep53Hash(message: string): Buffer {
  return Buffer.from(hash(Buffer.concat([Buffer.from(SEP53_PREFIX, "utf8"), Buffer.from(message, "utf8")])));
}

/**
 * Wallets return the signature in different shapes (base64 string, hex
 * string, serialized Buffer, byte array). Normalize to raw bytes.
 */
export function decodeSignature(sig: unknown): Buffer | null {
  if (typeof sig === "string") {
    if (/^[0-9a-f]{128}$/i.test(sig)) return Buffer.from(sig, "hex");
    const b = Buffer.from(sig, "base64");
    return b.length === 64 ? b : null;
  }
  if (Array.isArray(sig) && sig.every((n) => Number.isInteger(n))) {
    return Buffer.from(sig as number[]);
  }
  if (sig && typeof sig === "object" && "data" in sig && Array.isArray((sig as { data: unknown }).data)) {
    return Buffer.from((sig as { data: number[] }).data);
  }
  return null;
}

export function isStellarAccount(address: unknown): address is string {
  return typeof address === "string" && StrKey.isValidEd25519PublicKey(address);
}

/** True if `signature` is `address`'s SEP-53 signature over `message`. */
export function verifySignedMessage(address: string, message: string, signature: unknown): boolean {
  if (!isStellarAccount(address)) return false;
  const sig = decodeSignature(signature);
  if (!sig || sig.length !== 64) return false;
  try {
    return Keypair.fromPublicKey(address).verify(sep53Hash(message), sig);
  } catch {
    return false;
  }
}
