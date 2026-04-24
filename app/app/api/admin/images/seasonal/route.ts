import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { uploadImageToR2, convertToWebP } from "@/lib/images/r2";
import { getDb } from "@/lib/db/connection";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createRateLimiter } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/admin/actions";
import { logger } from "@/lib/logger";

// Per-admin throttle. R2 upload + WebP conversion is expensive; cap a bit
// tighter than the generic 30/min. User-keyed.
const isMutationLimited = createRateLimiter({ windowMs: 60_000, max: 20 });

const seasonalSchema = z.object({
  season: z.enum(["spring", "summer", "autumn", "winter"]),
  imageBase64: z.string().min(1),
  fluxPrompt: z.string().min(1),
  style: z.string(),
  fluxTaskId: z.string().optional(),
  setActive: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
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

    const seasonalId = Number(info.lastInsertRowid);

    logAdminAction({
      adminId: user.userId,
      actionType: "create_seasonal_image",
      targetType: "image",
      targetId: seasonalId,
      details: {
        season: data.season,
        style: data.style,
        setActive: data.setActive,
        fluxTaskId: data.fluxTaskId ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      image: { id: seasonalId, url: imageUrl, r2Key },
    });
  } catch (error) {
    // Raw errors may include R2/AWS SDK details or sharp internals.
    // Per CLAUDE.md §6, return a generic message to the client and log details server-side only.
    logger.error(
      { route: "/api/admin/images/seasonal", userId: user.userId, err: error },
      "Failed to save seasonal image"
    );
    return NextResponse.json({ error: "Failed to save seasonal image" }, { status: 500 });
  }
}
