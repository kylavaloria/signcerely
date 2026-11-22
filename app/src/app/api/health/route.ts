import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Always run on request: the point is to reach the database every time.
export const dynamic = "force-dynamic";

/**
 * Health check that makes one tiny database read. A scheduled GitHub Actions
 * job calls it every few days (.github/workflows/keep-alive.yml) so the
 * Supabase free plan doesn't pause the database for inactivity.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { error } = await db().from("profiles").select("wallet_address", { head: true, count: "exact" }).limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers });
  } catch (e) {
    console.error("health check failed", e);
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
