import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db/connection";
import { z } from "zod";

const reorderSchema = z.object({
  studyId: z.number().int().positive(),
  imageIds: z.array(z.number().int().positive()),
});

export async function PUT(request: NextRequest) {
  const { response: authResponse } = await requireAdmin();
  if (authResponse) return authResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { studyId, imageIds } = parsed.data;
  const db = getDb();

  const updateStmt = db.prepare(
    "UPDATE study_images SET sort_order = ? WHERE id = ? AND study_id = ?"
  );

  db.transaction(() => {
    imageIds.forEach((imageId, index) => {
      updateStmt.run(index, imageId, studyId);
    });
  })();

  return NextResponse.json({ success: true });
}
