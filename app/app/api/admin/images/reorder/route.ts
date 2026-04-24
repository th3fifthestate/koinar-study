import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db/connection";
import { z } from "zod";
import { createRateLimiter } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/admin/actions";

// Per-admin throttle. Reorder is cheap (N row updates in a txn) but still
// worth capping — a stuck UI loop shouldn't be able to hammer the DB.
const isMutationLimited = createRateLimiter({ windowMs: 60_000, max: 30 });

const reorderSchema = z.object({
  studyId: z.number().int().positive(),
  imageIds: z.array(z.number().int().positive()),
});

export async function PUT(request: NextRequest) {
  const { user, response: authResponse } = await requireAdmin();
  if (authResponse) return authResponse;

  if (isMutationLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

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

  logAdminAction({
    adminId: user.userId,
    actionType: "reorder_images",
    targetType: "study",
    targetId: studyId,
    details: { imageCount: imageIds.length, imageIds },
  });

  return NextResponse.json({ success: true });
}
