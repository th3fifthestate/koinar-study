import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const suggestSchema = z.object({
  studyTitle: z.string().min(1).max(500),
  studyContent: z.string().max(4000),
  style: z.enum(["cinematic", "classical", "illustrated"]),
});

const styleInstructions: Record<string, string> = {
  cinematic:
    "photorealistic cinematic with dramatic natural lighting and biblical-era ancient Near East setting",
  classical: "Renaissance oil painting with warm golden tones and dramatic chiaroscuro",
  illustrated:
    "modern editorial ink and watercolor illustration with a limited warm color palette",
};

export async function POST(request: NextRequest) {
  const { response: authResponse } = await requireAdmin();
  if (authResponse) return authResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = suggestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { studyTitle, studyContent, style } = parsed.data;

  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: `You are an expert at writing image generation prompts for the Flux AI model. Given a Bible study title and excerpt, generate a vivid scene description that would make a compelling hero image. The image should be ${styleInstructions[style]}.

Rules:
- Describe a SINGLE specific scene, not abstract concepts
- Include setting details (time of day, landscape, architecture)
- Include atmospheric details (lighting, mood, weather)
- Be historically accurate to the biblical era (no anachronisms)
- Do not include text, watermarks, or lettering in the scene
- Do not describe human faces in detail (keep figures at medium/far distance or from behind)
- Keep the prompt under 200 words
- Output ONLY the scene description, no preamble or explanation`,
      prompt: `Study title: "${studyTitle}"\n\nExcerpt:\n${studyContent.slice(0, 3000)}`,
      maxOutputTokens: 300,
    });

    return NextResponse.json({ suggestedPrompt: text.trim() });
  } catch (error) {
    // Anthropic SDK errors can include API keys, rate-limit tokens, internal URLs.
    // Per CLAUDE.md §6, return a generic message to the client and log details server-side only.
    console.error("[POST /api/admin/images/suggest-prompt]", error);
    return NextResponse.json(
      { error: "Failed to generate prompt suggestion" },
      { status: 500 }
    );
  }
}
