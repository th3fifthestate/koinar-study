// app/app/api/studies/[id]/export/route.ts
//
// POST — generate a downloadable export of a study and return a presigned
// R2 URL with 24-hour TTL.
//
// Compliance posture (see founders-files/abs-compliance-checklist.md):
//
//   1. Auth: requireAuth() per CLAUDE.md §2 — no anonymous exports.
//   2. Rate-limit: 1 export per 10 s per user (CLAUDE.md §5).
//   3. Translation gate: isExportAllowed() — combines per-translation
//      static permission (NIV is hard-disabled per Biblica §V) with the
//      live `getAvailableTranslations()` list (purge fail-closed).
//   4. Display content reuse: the client passes the markdown it's
//      currently rendering. The export pipeline never refetches verses,
//      so the NIV per-view cap, FUMS-fetch tokens, and api.bible per-work
//      cap are all already enforced upstream by the swap engine.
//   5. FUMS audit trail: licensed-translation exports record a `display`
//      event under `surface = export:<studyId>`.
//   6. Long-form copyright + publisher link: embedded by the renderer.

import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware";
import { getStudyForTranslate } from "@/lib/db/queries";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rate-limit";
import { parseStudyMarkdown } from "@/lib/export/markdown-parser";
import { renderStudyToPdf } from "@/lib/export/pdf-renderer";
import { putExport } from "@/lib/export/r2-export-storage";
import { recordFumsEvent } from "@/lib/translations/fums-tracker";
import {
  TRANSLATIONS,
  isExportAllowed,
  type TranslationId,
} from "@/lib/translations/registry";

const BodySchema = z.object({
  format: z.literal("pdf"),
  translation: z.enum([
    "BSB",
    "KJV",
    "WEB",
    "NLT",
    "NIV",
    "NASB",
    "ESV",
  ] as const),
  // Cap the markdown size at ~512 KB. Real studies are ~25 KB; the cap
  // protects the server from a hostile client trying to OOM the renderer.
  displayContent: z.string().min(1).max(512_000),
});

const isExportRateLimited = createRateLimiter({ windowMs: 10_000, max: 1 });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireAuth();
  if (response) return response;

  if (isExportRateLimited(`u:${user.userId}`)) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  const { id } = await params;
  const studyId = parseInt(id, 10);
  if (isNaN(studyId) || studyId <= 0) {
    return Response.json({ error: "Invalid study ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request" },
      { status: 400 },
    );
  }
  const { translation, displayContent } = parsed.data;

  // Fail closed — purge kill-switch, missing api.bible IDs, and the static
  // NIV prohibition all collapse into one check.
  if (!isExportAllowed(translation as TranslationId)) {
    const reason =
      TRANSLATIONS[translation as TranslationId].exportDisabledReason ??
      "Export is not available for this translation right now.";
    return Response.json({ error: reason }, { status: 403 });
  }

  const study = getStudyForTranslate(studyId);
  if (!study) {
    return Response.json({ error: "Study not found" }, { status: 404 });
  }
  if (!study.is_public && study.created_by !== user.userId) {
    return Response.json({ error: "Access denied" }, { status: 403 });
  }

  // Parse + render. Either step can throw on malformed input or font
  // problems; surface a generic 502 to the client and log details server-side
  // (CLAUDE.md §6 forbids leaking internals to the response).
  let pdfBuffer: Buffer;
  try {
    const ast = parseStudyMarkdown(displayContent);
    pdfBuffer = await renderStudyToPdf(ast, {
      translation: translation as TranslationId,
      study: {
        id: studyId,
        title: ast.title,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error(
      {
        route: "/api/studies/[id]/export",
        method: "POST",
        studyId,
        translation,
        userId: user.userId,
        err,
      },
      "Export rendering failed",
    );
    return Response.json(
      { error: "Could not generate export" },
      { status: 502 },
    );
  }

  // FUMS event for licensed translations. Public-domain translations
  // (BSB/KJV/WEB) don't require reporting. We log under surface = export
  // so the audit trail distinguishes downloads from in-app reads.
  if (TRANSLATIONS[translation as TranslationId].isLicensed) {
    recordFumsEvent({
      translation,
      // Display events have no upstream-issued fumsToken. The flusher
      // groups by session and ships them as a "display" record.
      fumsToken: null,
      eventType: "display",
      studyId,
      userId: user.userId,
      verseCount: countVerseQuotesInMarkdown(displayContent),
      surface: { kind: "export", studyId: String(studyId) },
      sessionId: user.sessionId ?? null,
    });
  }

  let upload;
  try {
    upload = await putExport({
      userId: user.userId,
      studyId,
      translation,
      format: "pdf",
      buffer: pdfBuffer,
      filename: makeDownloadFilename(study.id, translation, "pdf"),
    });
  } catch (err) {
    logger.error(
      {
        route: "/api/studies/[id]/export",
        method: "POST",
        studyId,
        translation,
        userId: user.userId,
        err,
      },
      "Export upload to R2 failed",
    );
    return Response.json(
      { error: "Could not store export" },
      { status: 502 },
    );
  }

  return Response.json(
    {
      url: upload.url,
      expiresAt: upload.expiresAt,
      filename: makeDownloadFilename(study.id, translation, "pdf"),
    },
    { status: 200 },
  );
}

/**
 * Best-effort verse count by scanning blockquote citations in the source
 * markdown. Each `(TRA)` tail counts as one verse range — collapses ranges
 * (e.g. v13-14) into a single event since FUMS reports "displays", not
 * individual verses, and we don't have a per-verse audit need on export.
 */
function countVerseQuotesInMarkdown(md: string): number {
  const matches = md.match(/—\s*[1-3]?\s?[A-Za-z]+(?:\s[A-Za-z]+)*\s\d+:\d+(?:[-–]\d+(?::\d+)?)?\s+\([A-Z]{2,5}\)/g);
  return matches?.length ?? 0;
}

function makeDownloadFilename(
  studyId: number,
  translation: string,
  format: "pdf",
): string {
  return `koinar-study-${studyId}-${translation}.${format}`;
}
