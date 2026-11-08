"use server";

import { verifyFingerprint, type VerifyResult } from "@/lib/verify";

/** Public: check a file fingerprint (computed in the visitor's browser). */
export async function checkFingerprint(fileHash: string): Promise<VerifyResult> {
  return verifyFingerprint(String(fileHash).toLowerCase());
}
