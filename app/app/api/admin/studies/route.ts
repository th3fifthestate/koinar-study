import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db/connection";

export async function GET() {
  const { response: authResponse } = await requireAdmin();
  if (authResponse) return authResponse;

  const db = getDb();
  const studies = db
    .prepare(
      "SELECT id, title, content_markdown FROM studies ORDER BY created_at DESC"
    )
    .all() as { id: number; title: string; content_markdown: string }[];

  return NextResponse.json({ studies });
}
