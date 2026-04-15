import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { deleteImageFromR2 } from "@/lib/images/r2";
import { getDb } from "@/lib/db/connection";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: authResponse } = await requireAdmin();
  if (authResponse) return authResponse;
  void request;

  const { id } = await params;
  const imageId = parseInt(id, 10);
  if (isNaN(imageId)) {
    return NextResponse.json({ error: "Invalid image ID" }, { status: 400 });
  }

  const db = getDb();

  const image = db
    .prepare("SELECT id, r2_key FROM study_images WHERE id = ?")
    .get(imageId) as { id: number; r2_key: string | null } | undefined;

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (image.r2_key) {
    try {
      await deleteImageFromR2(image.r2_key);
    } catch (error) {
      console.error("[DELETE /api/admin/images/[id]] R2 deletion failed:", error);
      // Continue to delete the database record even if R2 deletion fails
    }
  }

  db.prepare("DELETE FROM study_images WHERE id = ?").run(imageId);

  return NextResponse.json({ success: true });
}
