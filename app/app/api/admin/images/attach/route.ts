import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { uploadImageToR2, convertToWebP, makeImageKey } from "@/lib/images/r2";
import { getDb } from "@/lib/db/connection";
import { z } from "zod";
import { randomUUID } from "crypto";

const attachSchema = z.object({
  studyId: z.number().int().positive(),
  imageBase64: z.string().min(1),
  fluxPrompt: z.string().min(1),
  style: z.string(),
  aspectRatio: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  isHero: z.boolean().optional().default(false),
  fluxTaskId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { user, response: authResponse } = await requireAdmin();
  if (authResponse) return authResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = attachSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const rawBuffer = Buffer.from(data.imageBase64, "base64");
    const { buffer: webpBuffer, sizeBytes } = await convertToWebP(rawBuffer);

    // Use a UUID for the R2 path to avoid collisions
    const imageUuid = randomUUID();
    const r2Key = makeImageKey(data.studyId, imageUuid);
    const imageUrl = await uploadImageToR2(webpBuffer, r2Key);

    const db = getDb();
    const maxOrder = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM study_images WHERE study_id = ?"
      )
      .get(data.studyId) as { max_order: number };

    const info = db
      .prepare(
        `INSERT INTO study_images
          (study_id, image_url, r2_key, flux_prompt, style, aspect_ratio, width, height, size_bytes, sort_order, is_hero, flux_task_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.studyId,
        imageUrl,
        r2Key,
        data.fluxPrompt,
        data.style,
        data.aspectRatio,
        data.width,
        data.height,
        sizeBytes,
        maxOrder.max_order + 1,
        data.isHero ? 1 : 0,
        data.fluxTaskId ?? null,
        user.userId
      );

    const imageId = Number(info.lastInsertRowid);

    if (data.isHero) {
      db.prepare(
        "UPDATE study_images SET is_hero = 0 WHERE study_id = ? AND id != ?"
      ).run(data.studyId, imageId);
    }

    return NextResponse.json({
      success: true,
      image: { id: imageId, url: imageUrl, r2Key, sizeBytes },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to attach image";
    console.error("[POST /api/admin/images/attach]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
