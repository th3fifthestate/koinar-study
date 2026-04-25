// app/app/api/study/generate/route.ts
import { NextResponse } from "next/server";
import { streamText, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { requireAuth } from "@/lib/auth/middleware";
import { hasValidStepUpSession } from "@/lib/auth/step-up";
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
import crypto from 'crypto';
import { stripEntityAnnotations } from '@/lib/entities/strip-annotations';
import { stripPreamble } from '@/lib/ai/strip-preamble';
import { insertStudyAnnotations } from '@/lib/db/entities/queries';
import { logger } from '@/lib/logger';

// 5 generations per 5-minute window per user
const rateLimiter = createRateLimiter({ windowMs: 300_000, max: 5 });

// Allowlist of Claude model IDs we are willing to bill against. Keep this in
// sync with `env.AI_MODEL_ID` and the models referenced in `lib/config.ts`.
// Anything outside this set is rejected so a caller can't point generation
// at a wildly expensive or otherwise unintended model.
const ALLOWED_MODELS = [
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
] as const;

const requestSchema = z.object({
  prompt: z.string().min(5).max(2000),
  format: z
    .enum(["quick", "standard", "comprehensive"])
    .default("comprehensive"),
  translation: z.enum(["bsb", "esv", "kjv", "nlt"]).default("bsb"),
  model: z.enum(ALLOWED_MODELS).optional(),
});

/**
 * Per-tier output ceiling for streamText. Sized so the longest legitimate
 * response in each tier fits with headroom (we'd rather pay for an extra
 * 200 unused tokens than truncate a Conclusion mid-sentence). Roughly:
 *   - quick:         600–1,200 words   ≈   900–1,800 tokens, ceiling 4k
 *   - standard:    2,500–3,000 words   ≈ 3,500–4,200 tokens, ceiling 6k
 *   - comprehensive: 4,500–6,000 words ≈ 6,300–8,400 tokens, ceiling 12k
 * Keep these numbers in sync with FORMAT_GUIDANCE in lib/ai/system-prompt.ts
 * and the cost bands in founders-files/runbooks/study-generation-tiers.md.
 */
const MAX_OUTPUT_TOKENS_PER_TIER: Record<
  "quick" | "standard" | "comprehensive",
  number
> = {
  quick: 4_096,
  standard: 6_144,
  comprehensive: 12_288,
};

/** Tags Anthropic asks us not to retry-with-shorter on. We forward the LLM-
 *  emitted study_type into the metadata block; if it's missing or invalid we
 *  fall back to 'topical'. The DB CHECK constraint also enforces this. */
const VALID_STUDY_TYPES = new Set(["passage", "person", "word", "topical", "book"] as const);
type StudyType = "passage" | "person" | "word" | "topical" | "book";

export async function POST(request: Request) {
  // 1. Auth check — must be first
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  // 2. Rate limit by user ID (generation is expensive)
  if (rateLimiter(String(auth.user.userId))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { 'Retry-After': '300' } });
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
  let pendingGiftCode: { code: string; format: typeof format } | null = null;

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
    // Admin — gated by TOTP step-up before we hand out the platform key.
    // This is layered on top of the email-2FA that already runs at login.
    // Rationale: login 2FA sits on the admin's email account; if that is
    // ever compromised, TOTP on a physical authenticator is the second
    // independent factor that must also fall before platform-key abuse is
    // possible. 403 + STEP_UP_REQUIRED lets the UI open the TOTP modal
    // instead of treating this as a generic forbidden.
    if (!hasValidStepUpSession(auth.user.userId)) {
      return NextResponse.json(
        {
          error: "Step-up verification required",
          code: "STEP_UP_REQUIRED",
        },
        { status: 403 }
      );
    }
    const platformKey = config.ai.anthropicApiKey;
    if (!platformKey) {
      return NextResponse.json(
        {
          error: "AI service not configured",
          ...(process.env.NODE_ENV === "development" && {
            details:
              "Missing ANTHROPIC_API_KEY in app/.env — see founders-files/runbooks/env-dev-loading.md",
          }),
        },
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
    // Store gift code info — consumption deferred to onFinish after study is saved
    pendingGiftCode = { code: validCode.code, format };
    const platformKey = config.ai.anthropicApiKey;
    if (!platformKey) {
      return NextResponse.json(
        {
          error: "AI service not configured",
          ...(process.env.NODE_ENV === "development" && {
            details:
              "Missing ANTHROPIC_API_KEY in app/.env — see founders-files/runbooks/env-dev-loading.md",
          }),
        },
        { status: 503 }
      );
    }
    apiKey = platformKey;
  }

  // 5. Build provider, system prompt, and start timer
  // Explicit baseURL prevents ANTHROPIC_BASE_URL shell var (set to "https://api.anthropic.com"
  // for @anthropic-ai/sdk) from stripping the /v1 prefix → Cloudflare 404.
  const provider = createAnthropic({ apiKey, baseURL: 'https://api.anthropic.com/v1' });
  const systemPrompt = getSystemPrompt(format);
  const startTime = Date.now();
  const userId = auth.user.userId;

  // Terminal frame promise — resolved inside onFinish after the DB write,
  // OR by onError / the reader-loop catch if the stream errors before onFinish
  // fires. Without these fallbacks, model/tool errors silently abort the SSE
  // stream and the client only sees "the line dropped" with no diagnostic.
  let terminalResolve!: (frame: { slug: string; saveOk: boolean; title: string }) => void;
  const terminalPromise = new Promise<{ slug: string; saveOk: boolean; title: string }>(
    (resolve) => { terminalResolve = resolve; }
  );

  // Idempotent terminal-frame resolver — guards against double-resolution
  // when both onError and onFinish (or the reader loop catch) try to settle
  // the frame.
  let resolvedTerminal = false;
  const safeResolve = (frame: { slug: string; saveOk: boolean; title: string }) => {
    if (resolvedTerminal) return;
    resolvedTerminal = true;
    terminalResolve(frame);
  };

  // 6. Stream generation
  // System prompt + tool definitions are cached (ephemeral, ~5 min TTL) —
  // setting cacheControl on the system message caches everything before the
  // breakpoint, including tool definitions. Saves ~90% on input tokens for
  // repeat generations within the cache window.
  const result = streamText({
    model: provider(model ?? config.ai.modelId),
    maxOutputTokens: MAX_OUTPUT_TOKENS_PER_TIER[format],
    messages: [
      {
        role: "system",
        content: systemPrompt,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      { role: "user", content: prompt },
    ],
    tools: studyTools,
    stopWhen: stepCountIs(30),
    onError: ({ error }) => {
      // Vercel AI SDK fires this when the model / tool execution / network
      // errors mid-stream. Without it the SDK silently rejects internally
      // and the client sees "the line dropped" with no log line. Resolve
      // the terminal frame so the client gets a clean error-save-failed
      // navigation; logger.error gives us the actual cause for debugging.
      logger.error(
        { route: "/api/study/generate", userId: auth.user.userId, err: error },
        "streamText errored mid-stream",
      );
      safeResolve({ slug: '', saveOk: false, title: prompt.slice(0, 100) });
    },
    onFinish: async ({ text: rawText, totalUsage, steps, providerMetadata }) => {
      const duration = Date.now() - startTime;

      try {
      // Strip any conversational preamble the model emitted before the H1
      // (e.g., "Excellent. Let me compose the study."). System prompt tells
      // the model not to do this; this is the persistence-layer backstop so
      // the stored markdown always starts with the study title.
      const { cleaned: text, stripped: strippedPreamble } = stripPreamble(rawText);
      if (strippedPreamble) {
        console.warn(
          `[generate/onFinish] Stripped preamble before H1 (${strippedPreamble.length} chars): ${JSON.stringify(strippedPreamble.slice(0, 120))}`,
        );
      }
      const anthropicMeta = providerMetadata?.anthropic as
        | { cacheCreationInputTokens?: number; cacheReadInputTokens?: number }
        | undefined;

      // Parse json-metadata block
      interface EntityAnnotationMeta {
        surface: string;
        entity_id: string;
      }

      let metadata = {
        category: "topical",
        tags: [] as string[],
        topic: prompt,
        summary: "",
        study_type: "topical" as StudyType,
      };
      // Historically this pipeline also harvested entity_annotations from
      // the metadata block to seed the annotation pipeline. That path is
      // unused today — annotations are backfilled by a separate script
      // after save. Kept the parse/merge for metadata alone; the
      // entity_annotations key is tolerated-but-ignored in the payload.
      const metadataMatch = text.match(/```json-metadata\s*\n([\s\S]*?)\n```/);
      if (metadataMatch) {
        try {
          const parsed = JSON.parse(metadataMatch[1]) as Partial<typeof metadata> & {
            entity_annotations?: EntityAnnotationMeta[];
            study_type?: string;
          };
          // Hard-validate study_type against the DB CHECK constraint values.
          // An LLM that emits an unknown type would otherwise crash the INSERT.
          const rawType = parsed.study_type;
          const safeType: StudyType =
            typeof rawType === "string" && VALID_STUDY_TYPES.has(rawType as StudyType)
              ? (rawType as StudyType)
              : "topical";
          metadata = {
            category: parsed.category ?? metadata.category,
            tags: Array.isArray(parsed.tags) ? parsed.tags : metadata.tags,
            topic: parsed.topic ?? metadata.topic,
            summary: parsed.summary ?? metadata.summary,
            study_type: safeType,
          };
        } catch {
          // Use defaults if JSON parsing fails
        }
      }

      // Parse the verification-audit fence (admin-only audit log; never rendered).
      // Schema is loose-by-design — the LLM emits whatever shape it finds useful;
      // we just need to confirm it's a JSON array before storing. Anything else
      // (malformed JSON, missing fence) yields an empty array and a console warn.
      let auditQueries: Array<Record<string, unknown>> = [];
      const auditMatch = text.match(/```verification-audit\s*\n([\s\S]*?)\n```/);
      if (auditMatch) {
        try {
          const parsedAudit = JSON.parse(auditMatch[1]);
          if (Array.isArray(parsedAudit)) {
            auditQueries = parsedAudit.filter(
              (q): q is Record<string, unknown> => typeof q === "object" && q !== null,
            );
          } else {
            console.warn("[generate/onFinish] verification-audit fence is not a JSON array; ignoring");
          }
        } catch (err) {
          console.warn(
            "[generate/onFinish] verification-audit JSON parse failed:",
            err instanceof Error ? err.message : err,
          );
        }
      }

      // Extract title from first markdown heading
      const titleMatch = text.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : prompt.slice(0, 100);

      // Strip metadata and verification-audit blocks first (these live at the end of the text)
      const textWithoutCodeBlocks = text
        .replace(/```json-metadata[\s\S]*?```/g, "")
        .replace(/```verification-audit[\s\S]*?```/g, "")
        .trim();

      // Strip entity annotation markers and compute character offsets
      // Offsets are relative to the final stored markdown (after code block removal)
      const { cleanMarkdown: cleanContent, annotations: inlineAnnotations } =
        stripEntityAnnotations(textWithoutCodeBlocks);

      // SHA-256 of the stored content — used for annotation cache invalidation
      const contentHash = crypto.createHash('sha256').update(cleanContent).digest('hex');

      // Collect unique tool names from all steps
      const toolsCalled = [
        ...new Set(
          steps?.flatMap((s) => s.toolCalls?.map((tc) => tc.toolName) ?? []) ??
            []
        ),
      ];

      // Estimated cost (Opus 4.6: $5/MTok input, $25/MTok output)
      // Cache reads are 10% of base input; cache writes are 125% of base input.
      // totalUsage aggregates across all steps; usage is last step only.
      const inputTokens = totalUsage?.inputTokens ?? 0;
      const outputTokens = totalUsage?.outputTokens ?? 0;
      const cacheReadTokens = anthropicMeta?.cacheReadInputTokens ?? 0;
      const cacheWriteTokens = anthropicMeta?.cacheCreationInputTokens ?? 0;
      const estimatedCost =
        (inputTokens / 1_000_000) * 5 +
        (cacheReadTokens / 1_000_000) * 0.5 +
        (cacheWriteTokens / 1_000_000) * 6.25 +
        (outputTokens / 1_000_000) * 25;

      // Save study to database
      let slug = '';
      try {
        slug = generateSlug(title);
        const studyId = createStudy({
          title,
          slug,
          content_markdown: cleanContent,
          summary: metadata.summary || undefined,
          format_type: format,
          translation_used: translation.toUpperCase(),
          created_by: userId,
          study_type: metadata.study_type,
          source_prompt: prompt,
          generation_metadata: JSON.stringify({
            model: model ?? config.ai.modelId,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cache_read_tokens: cacheReadTokens,
            cache_write_tokens: cacheWriteTokens,
            estimated_cost: estimatedCost,
            duration_ms: duration,
            tools_called: toolsCalled,
            prompt,
            is_byok: isByok,
            study_type: metadata.study_type,
            queries: auditQueries,
          }),
        });

        // Set tags (validate length before storing)
        const safeTags = metadata.tags
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.slice(0, 50))
          .slice(0, 20);
        if (safeTags.length > 0) {
          setStudyTags(studyId, safeTags);
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

        // Consume gift code AFTER study is saved successfully
        if (pendingGiftCode) {
          const consumed = consumeGiftCode(pendingGiftCode.code, pendingGiftCode.format);
          if (!consumed) {
            logger.error(
              {
                route: "/api/study/generate",
                event: "gift_code_consume_failed",
                userId: auth.user.userId,
                giftFormat: pendingGiftCode.format,
              },
              "Gift code consumption failed after study saved"
            );
          }
        }

        // Insert entity annotations (after study saved so studyId is available)
        if (inlineAnnotations.length > 0) {
          // Filter out entity IDs that don't exist in the DB to avoid FK constraint failures
          const annotationEntityIds = [...new Set(inlineAnnotations.map((a) => a.entity_id))];
          const placeholders = annotationEntityIds.map(() => '?').join(',');
          const knownIds = new Set(
            (getDb()
              .prepare(`SELECT id FROM entities WHERE id IN (${placeholders})`)
              .all(...annotationEntityIds) as { id: string }[]).map((r) => r.id)
          );
          const safeAnnotations = inlineAnnotations.filter((a) => knownIds.has(a.entity_id));

          if (safeAnnotations.length < inlineAnnotations.length) {
            console.warn(
              `[generate/onFinish] Filtered ${inlineAnnotations.length - safeAnnotations.length} annotations with unknown entity IDs`
            );
          }

          if (safeAnnotations.length > 0) {
            insertStudyAnnotations(
              safeAnnotations.map((a) => ({
                study_id: studyId,
                entity_id: a.entity_id,
                surface_text: a.surface_text,
                start_offset: a.start_offset,
                end_offset: a.end_offset,
                content_hash: contentHash,
                annotation_source: 'ai_generation' as const,
              }))
            );
          }
        } else {
          // render_fallback annotator will handle this study on first page load
          console.warn(
            `[generate/onFinish] No inline entity annotations found for study "${title}" (id: ${studyId})`
          );
        }

        safeResolve({ slug, saveOk: true, title });
      } catch (error) {
        logger.error(
          { route: "/api/study/generate", userId: auth.user.userId, err: error },
          "Failed to save study in onFinish"
        );
        safeResolve({ slug: '', saveOk: false, title: prompt.slice(0, 100) });
      }
      } catch (error) {
        // Outer guard: anything that threw OUTSIDE the inner createStudy
        // try/catch above (preamble stripping, regex parsing, entity-annotation
        // stripping, crypto hashing, token math, JSON.stringify of metadata,
        // etc.) lands here. Log with a distinct message so we can tell pre-DB
        // failures apart from createStudy failures, and resolve the terminal
        // frame so the client navigates to the error-save-failed state instead
        // of hanging on the SSE stream.
        logger.error(
          { route: "/api/study/generate", userId: auth.user.userId, err: error },
          "onFinish handler threw before reaching createStudy"
        );
        safeResolve({ slug: '', saveOk: false, title: prompt.slice(0, 100) });
      }
    },
  });

  // 7. Return combined stream: model text + terminal JSON frame after DB write
  // The terminal frame `<!-- koinar-complete:{...} -->` is appended after the text
  // stream closes, once onFinish resolves. The client strips this marker and uses
  // it to drive the completing → complete (or error-save-failed) transition.
  const encoder = new TextEncoder();

  // Tracks whether the downstream consumer (browser fetch / Next.js runtime)
  // has cancelled. Set by the `cancel()` hook below and consumed by the
  // tryEnqueue helper inside `start()` to short-circuit further writes.
  // Without this, the reader loop keeps pulling chunks from textStream and
  // calling controller.enqueue() against a closed controller, which throws
  // "Invalid state: Controller is already closed" and surfaces to the client
  // as the "line dropped" error UI.
  let downstreamClosed = false;

  const combinedStream = new ReadableStream({
    async start(controller) {
      // Track when we last actually wrote bytes. The client aborts after 20s
      // of silence, and during long tool-call sequences the model emits no
      // text — so without a heartbeat the connection looks dead even though
      // the server is happily generating.
      let lastEnqueueAt = Date.now();

      // Idempotent enqueue. Returns false if the controller is closed (or
      // closes in a TOCTOU race between the flag check and enqueue), so the
      // caller can break out of the loop. Any other error is rethrown.
      const tryEnqueue = (chunk: Uint8Array): boolean => {
        if (downstreamClosed) return false;
        try {
          controller.enqueue(chunk);
          lastEnqueueAt = Date.now();
          return true;
        } catch (err) {
          if (err instanceof TypeError && /closed/i.test(err.message)) {
            downstreamClosed = true;
            return false;
          }
          throw err;
        }
      };

      // Heartbeat: emit a single space every ~10s if no real bytes have
      // flowed. Comfortably under the client's 20s abort threshold, with
      // headroom for jitter. Heartbeat bytes are harmless — the saved
      // markdown is built from streamText's onFinish text, not from
      // on-the-wire bytes, so the trailing space never touches the DB.
      const HEARTBEAT_MS = 10_000;
      const heartbeat = setInterval(() => {
        if (downstreamClosed) return;
        if (Date.now() - lastEnqueueAt > HEARTBEAT_MS) {
          tryEnqueue(encoder.encode(' '));
        }
      }, 2_500);

      const reader = result.textStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!tryEnqueue(encoder.encode(value))) break;
        }
      } catch (readerErr) {
        // textStream rejected — typically because onError already fired and
        // the SDK is propagating the error through the stream. Log a distinct
        // line so we can tell reader-loop failures apart from upstream errors,
        // and ensure the terminal frame is settled so the client navigates
        // instead of seeing "the line dropped" with no recovery.
        logger.error(
          { route: "/api/study/generate", userId: auth.user.userId, err: readerErr },
          "Combined-stream reader threw — textStream rejected",
        );
        safeResolve({ slug: '', saveOk: false, title: prompt.slice(0, 100) });
      } finally {
        clearInterval(heartbeat);
        reader.releaseLock();
      }
      const terminal = await terminalPromise;
      tryEnqueue(encoder.encode(`\n\n<!-- koinar-complete:${JSON.stringify(terminal)} -->`));
      if (!downstreamClosed) {
        try {
          controller.close();
        } catch {
          // Controller already closed by the runtime — nothing to do.
        }
      }
    },
    cancel() {
      // Consumer disconnected. Flag it so any in-flight tryEnqueue short-circuits,
      // then propagate the cancellation upstream so streamText stops generating
      // (and stops billing for tokens we'll never deliver). Logged at warn level
      // so future hangs (vs. legitimate user navigation-aways) are diagnosable.
      const elapsedMs = Date.now() - startTime;
      logger.warn(
        { route: "/api/study/generate", userId: auth.user.userId, elapsedMs },
        "Combined-stream consumer disconnected (client cancel / fetch abort)",
      );
      downstreamClosed = true;
      result.textStream.cancel?.();
    },
  });

  return new Response(combinedStream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    },
  });
}
