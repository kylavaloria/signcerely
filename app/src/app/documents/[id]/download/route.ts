import { NextResponse } from "next/server";
import { signedCopyResponse } from "@/lib/download";
import { getSession } from "@/lib/session";
import { db } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data: doc } = await db()
    .from("documents")
    .select("title, status, final_file_path")
    .eq("id", id)
    .eq("sender_wallet", session.wallet)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return signedCopyResponse(doc);
}
