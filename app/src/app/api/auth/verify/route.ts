import { NextResponse, type NextRequest } from "next/server";
import { buildSignInMessage, isStellarAccount, verifySignedMessage } from "@/lib/auth-message";
import { safeNext } from "@/lib/format";
import { getProfile } from "@/lib/profile";
import { createSession } from "@/lib/session";
import { db } from "@/lib/supabase";

/** Step 2 of sign-in: check the wallet's signature over the code, then start a session. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const address = body?.address;
  const nonce = body?.nonce;
  if (!isStellarAccount(address) || typeof nonce !== "string" || !/^[0-9a-f]{32}$/.test(nonce)) {
    return NextResponse.json({ error: "Sign-in request was incomplete." }, { status: 400 });
  }

  // Use the code exactly once: mark it used only if it's still valid.
  const { data: used, error } = await db()
    .from("auth_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("nonce", nonce)
    .eq("wallet_address", address)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("nonce");
  if (error) {
    console.error("auth_challenges update failed", error);
    return NextResponse.json({ error: "Couldn't finish sign-in. Please try again." }, { status: 500 });
  }
  if (!used || used.length !== 1) {
    return NextResponse.json({ error: "That sign-in code expired. Please try again." }, { status: 401 });
  }

  const message = buildSignInMessage({ address, nonce, origin: request.nextUrl.origin });
  if (!verifySignedMessage(address, message, body?.signature)) {
    return NextResponse.json(
      { error: "We couldn't confirm that signature came from this wallet." },
      { status: 401 },
    );
  }

  await createSession(address);
  const profile = await getProfile(address);
  const next = safeNext(body?.next);
  return NextResponse.json({
    next: profile ? (next ?? "/dashboard") : `/welcome${next ? `?next=${encodeURIComponent(next)}` : ""}`,
  });
}
