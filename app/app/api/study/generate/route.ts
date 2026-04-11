// app/app/api/study/generate/route.ts
import { NextResponse } from "next/server";
import { streamText, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { requireAuth } from "@/lib/auth/middleware";
import { studyTools } from "@/lib/ai/tools";
import { getSystemPrompt } from "@/lib/ai/system-prompt";
import { getUserApiKey } from "@/lib/ai/keys";
import {
  createStudy,
  getActiveGiftCodesForUser,
  consumeGiftCode,
  setStudyTags,
  getCategoryBySlug,
} from "@/lib/db/queries";
import { getDb } from "@/lib/db/connection";
import { config } from "@/lib/config";
import { generateSlug } from "@/lib/utils/slug";
import { createRateLimiter } from "@/lib/rate-limit";
import { z } from "zod";

// 5 generations per 5-minute window per user
const rateLimiter = createRateLimiter({ windowMs: 300_000, max: 5 });

const requestSchema = z.object({
  prompt: z.string().min(10).max(2000),
  format: z
    .enum(["simple", "standard", "comprehensive"])
    .default("comprehensive"),
  translation: z.enum(["bsb", "esv", "kjv", "nlt"]).default("bsb"),
  model: z.string().optional(),
});

export async function POST(request: Request) {
  // 1. Auth check — must be first
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  // 2. Rate limit by user ID (generation is expensive)
  if (rateLimiter(String(auth.user.userId))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // 3. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { prompt, format, translation, model } = parsed.data;

  // 4. Resolve API key
  // SafeUser omits api_key_encrypted — query it directly
  const userRow = getDb()
    .prepare("SELECT api_key_encrypted FROM users WHERE id = ?")
    .get(auth.user.userId) as { api_key_encrypted: string | null } | undefined;

  if (!userRow) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let apiKey: string;
  let isByok = false;

  if (userRow.api_key_encrypted) {
    // BYOK user — decrypt and use their key (unlimited generations)
    try {
      apiKey = getUserApiKey(userRow.api_key_encrypted);
    } catch {
      return NextResponse.json(
        { error: "Failed to retrieve API key — please re-enter it in settings" },
        { status: 500 }
      );
    }
    isByok = true;
  } else if (auth.user.isAdmin) {
    // Admin — use platform key
    const platformKey = config.ai.anthropicApiKey;
    if (!platformKey) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }
    apiKey = platformKey;
  } else {
    // Regular user — must have an active gift code for this format
    const giftCodes = getActiveGiftCodesForUser(auth.user.userId);
    const validCode = giftCodes.find(
      (gc) => gc.format_locked === format && gc.uses_remaining > 0
    );
    if (!validCode) {
      return NextResponse.json(
        {
          error: "Generation not available",
          message:
            "Add your own API key in settings or redeem a gift code to generate studies.",
        },
        { status: 403 }
      );
    }
    // Atomically consume one use (TOCTOU-safe transaction)
    const consumed = consumeGiftCode(validCode.code, format);
    if (!consumed) {
      return NextResponse.json(
        { error: "Gift code expired or depleted" },
        { status: 403 }
      );
    }
    const platformKey = config.ai.anthropicApiKey;
    if (!platformKey) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 503 }
      );
    }
    apiKey = platformKey;
  }

  // 5. Build provider, system prompt, and start timer
  const provider = createAnthropic({ apiKey });
  const systemPrompt = getSystemPrompt(format);
  const startTime = Date.now();
  const userId = auth.user.userId;

  // 6. Stream generation
  const result = streamText({
    model: provider(model ?? "claude-opus-4-6"),
    system: systemPrompt,
    prompt,
    tools: studyTools,
    stopWhen: stepCountIs(30),
    onFinish: async ({ text, usage, steps }) => {
      const duration = Date.now() - startTime;

      // Parse json-metadata block
      let metadata = {
        category: "topical",
        tags: [] as string[],
        topic: prompt,
        summary: "",
      };
      const metadataMatch = text.match(/```json-metadata\s*\n([\s\S]*?)\n```/);
      if (metadataMatch) {
        try {
          metadata = { ...metadata, ...(JSON.parse(metadataMatch[1]) as typeof metadata) };
        } catch {
          // Use defaults if JSON parsing fails
        }
      }

      // Extract title from first markdown heading
      const titleMatch = text.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : prompt.slice(0, 100);

      // Strip metadata and verification-audit blocks from stored content
      const cleanContent = text
        .replace(/```json-metadata[\s\S]*?```/g, "")
        .replace(/```verification-audit[\s\S]*?```/g, "")
        .trim();

      // Collect unique tool names from all steps
      const toolsCalled = [
        ...new Set(
          steps?.flatMap((s) => s.toolCalls?.map((tc) => tc.toolName) ?? []) ??
            []
        ),
      ];

      // Estimated cost (Opus 4.6: $5/MTok input, $25/MTok output)
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      const estimatedCost =
        (inputTokens / 1_000_000) * 5 + (outputTokens / 1_000_000) * 25;

      // Save study to database
      try {
        const slug = generateSlug(title);
        const studyId = createStudy({
          title,
          slug,
          content_markdown: cleanContent,
          summary: metadata.summary || undefined,
          format_type: format,
          translation_used: translation.toUpperCase(),
          created_by: userId,
          generation_metadata: JSON.stringify({
            model: model ?? "claude-opus-4-6",
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            estimated_cost: estimatedCost,
            duration_ms: duration,
            tools_called: toolsCalled,
            prompt,
            is_byok: isByok,
          }),
        });

        // Set tags
        if (metadata.tags.length > 0) {
          setStudyTags(studyId, metadata.tags);
        }

        // Set category
        if (metadata.category) {
          const category = getCategoryBySlug(metadata.category);
          if (category) {
            getDb()
              .prepare("UPDATE studies SET category_id = ? WHERE id = ?")
              .run(category.id, studyId);
          }
        }
      } catch (error) {
        console.error("[generate/onFinish] Failed to save study:", error);
      }
    },
  });

  // 7. Return streaming text response
  return result.toTextStreamResponse();
}
