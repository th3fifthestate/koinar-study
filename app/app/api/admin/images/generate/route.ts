import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { generateImage, estimateCost, FluxApiError } from "@/lib/images/flux";
import { getDimensions, type AspectRatio } from "@/lib/images/prompt-builder";
import { createRateLimiter } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/admin/actions";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Image generation costs real money per call. Admin-only, but limit spend
// in case a session is compromised: 20 calls per admin per hour.
const rateLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 });

const generateSchema = z.object({
  studyId: z.number().int().positive(),
  prompt: z.string().min(10).max(2000),
  style: z.enum(["cinematic", "classical", "illustrated"]),
  aspectRatio: z.enum(["16:9", "21:9", "4:3"]),
  model: z.enum(["flux-2-pro", "flux-2-max"]).optional().default("flux-2-pro"),
});

export async function POST(request: NextRequest) {
  const { user, response: authResponse } = await requireAdmin();
  if (authResponse) return authResponse;

  if (rateLimiter(String(user.userId))) {
    return NextResponse.json(
      { error: "Image generation rate limit reached. Try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { studyId, prompt, style, aspectRatio, model } = parsed.data;
  const dimensions = getDimensions(aspectRatio as AspectRatio);
  const cost = estimateCost(1, model);

  try {
    const { buffer, taskId } = await generateImage({
      prompt,
      width: dimensions.width,
      height: dimensions.height,
      model,
    });

    const base64 = buffer.toString("base64");

    // Preview only — no DB row yet — but Flux charged for the call, so audit
    // the money-spending action with the study as target.
    logAdminAction({
      adminId: user.userId,
      actionType: "generate_image_preview",
      targetType: "study",
      targetId: studyId,
      details: { style, aspectRatio, model, taskId, estimatedCost: cost.formatted },
    });

    return NextResponse.json({
      success: true,
      preview: `data:image/png;base64,${base64}`,
      taskId,
      estimatedCost: cost.formatted,
      sizeBytes: buffer.length,
    });
  } catch (error) {
    logger.error(
      { route: "/api/admin/images/generate", userId: user.userId, err: error },
      "Image generation failed"
    );
    // FluxApiError.message is curated and safe to return. Anything else gets a generic message.
    if (error instanceof FluxApiError) {
      const status = error.statusCode === 429 ? 429 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
