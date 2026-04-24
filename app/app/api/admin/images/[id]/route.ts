import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { deleteImageFromR2 } from "@/lib/images/r2";
import { getDb } from "@/lib/db/connection";
import { createRateLimiter } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/admin/actions";
import { logger } from "@/lib/logger";

// Per-admin throttle. Image DELETE hits R2 and the DB; user-keyed so NAT-
// sharing admins don't 429 each other.
const isMutationLimited = createRateLimiter({ windowMs: 60_000, max: 30 });

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response: authResponse } = await requireAdmin();
  if (authResponse) return authResponse;
  void request;

  if (isMutationLimited(`admin:${user.userId}`)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { id } = await params;
  const imageId = parseInt(id, 10);
  if (isNaN(imageId)) {
    return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
  }

  const db = getDb();

  const image = db
    .prepare("SELECT id, study_id, r2_key FROM study_images WHERE id = ?")
    .get(imageId) as { id: number; study_id: number; r2_key: string | null } | undefined;

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  let r2DeletionError = false;
  if (image.r2_key) {
    try {
      await deleteImageFromR2(image.r2_key);
    } catch (error) {
      logger.error(
        {
          route: "/api/admin/images/[id]",
          userId: user.userId,
          imageId,
          r2Key: image.r2_key,
          err: error,
        },
        "R2 deletion failed; continuing with DB delete"
      );
      r2DeletionError = true;
      // Continue to delete the database record even if R2 deletion fails
    }
  }

  db.prepare("DELETE FROM study_images WHERE id = ?").run(imageId);

  logAdminAction({
    adminId: user.userId,
    actionType: "delete_image",
    targetType: "image",
    targetId: imageId,
    details: {
      studyId: image.study_id,
      r2Key: image.r2_key,
      r2DeletionFailed: r2DeletionError,
    },
  });

  return NextResponse.json({ success: true });
}
