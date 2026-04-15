import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { generateImage, estimateCost } from "@/lib/images/flux";
import { getDimensions, type AspectRatio } from "@/lib/images/prompt-builder";
import { z } from "zod";

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
  void user;

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

  const { prompt, aspectRatio, model } = parsed.data;
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

    return NextResponse.json({
      success: true,
      preview: `data:image/png;base64,${base64}`,
      taskId,
      estimatedCost: cost.formatted,
      sizeBytes: buffer.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    console.error("[POST /api/admin/images/generate]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
