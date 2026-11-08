import { NextResponse } from "next/server";
import { signedCopyResponse } from "@/lib/download";
import { getAccess } from "@/lib/invite-access";

export async function GET(_req: Request, { params }: { params: Promise<{ signerId: string }> }) {
  const { signerId } = await params;
  const a = await getAccess(signerId);
  if (!a || (!a.invited && !a.isSender)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return signedCopyResponse(a.doc);
}
