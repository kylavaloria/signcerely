import "server-only";
import { NextResponse } from "next/server";
import { DOCS_BUCKET } from "./documents";
import { signedFileName } from "./file-name";
import { db } from "./supabase";

/** Redirect to a short-lived download link for a completed document's signed copy. */
export async function signedCopyResponse(doc: { title: string; status: string; final_file_path: string | null }) {
  if (doc.status !== "completed" || !doc.final_file_path) {
    return NextResponse.json({ error: "The signed copy isn’t ready yet." }, { status: 404 });
  }
  const name = signedFileName(doc.title);
  const { data, error } = await db().storage.from(DOCS_BUCKET).createSignedUrl(doc.final_file_path, 60, { download: name });
  if (error || !data) return NextResponse.json({ error: "Couldn’t create the download." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
