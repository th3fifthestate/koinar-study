import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { uploadImageToR2, convertToWebP } from "@/lib/images/r2";
import { getDb } from "@/lib/db/connection";
import { z } from "zod";
import { randomUUID } from "crypto";

const seasonalSchema = z.object({
  season: z.enum(["spring", "summer", "autumn", "winter"]),
  imageBase64: z.string().min(1),
  fluxPrompt: z.string().min(1),
  style: z.string(),
  fluxTaskId: z.string().optional(),
  setActive: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const { response: authResponse } = await requireAdmin();
  if (authResponse) return authResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = seasonalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const rawBuffer = Buffer.from(data.imageBase64, "base64");
    const { buffer: webpBuffer } = await convertToWebP(rawBuffer);

    const imageUuid = randomUUID();
    const r2Key = `seasonal/${data.season}/${imageUuid}.webp`;
    const imageUrl = await uploadImageToR2(webpBuffer, r2Key);

    const db = getDb();

    if (data.setActive) {
      db.prepare("UPDATE seasonal_images SET is_active = 0 WHERE season = ?").run(data.season);
    }

    const info = db
      .prepare(
        `INSERT INTO seasonal_images (season, r2_key, image_url, flux_prompt, style, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.season,
        r2Key,
        imageUrl,
        data.fluxPrompt,
        data.style,
        data.setActive ? 1 : 0
      );

    return NextResponse.json({
      success: true,
      image: { id: Number(info.lastInsertRowid), url: imageUrl, r2Key },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save seasonal image";
    console.error("[POST /api/admin/images/seasonal]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
