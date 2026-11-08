import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildSignInMessage, isStellarAccount } from "@/lib/auth-message";
import { db } from "@/lib/supabase";

const TTL_MS = 5 * 60 * 1000;

/** Step 1 of sign-in: issue a one-time code for this wallet to sign. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const address = body?.address;
  if (!isStellarAccount(address)) {
    return NextResponse.json({ error: "That doesn't look like a Stellar wallet address." }, { status: 400 });
  }

  const nonce = randomBytes(16).toString("hex");
  const { error } = await db()
    .from("auth_challenges")
    .insert({ nonce, wallet_address: address, expires_at: new Date(Date.now() + TTL_MS).toISOString() });
  if (error) {
    console.error("auth_challenges insert failed", error);
    return NextResponse.json({ error: "Couldn't start sign-in. Please try again." }, { status: 500 });
  }

  // Housekeeping: drop codes that expired more than a day ago.
  void db()
    .from("auth_challenges")
    .delete()
    .lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .then(() => undefined);

  const message = buildSignInMessage({ address, nonce, origin: request.nextUrl.origin });
  return NextResponse.json({ nonce, message });
}
