'use client';

import { useState } from 'react';
import type { StudyGenerationMetadata } from '@/lib/db/types';

interface VerificationPanelProps {
  /**
   * The full generation_metadata JSON string as stored on the study row.
   * The component parses defensively — anything that isn't a JSON object
   * with a `queries` array yields a no-op render so we never blow up
   * the reader for legitimate readers if the metadata is malformed.
   */
  generationMetadata: string | null;
}

/**
 * Admin-only audit panel rendering the SQL/tool queries the LLM emitted
 * inside the `verification-audit` code fence at generation time.
 *
 * This is the post-Phase-1 home for the audit log — historically the fence
 * was rendered inside the study markdown itself, which (a) leaked
 * generation-pipeline mechanics to readers and (b) made the studies look
 * unprofessional. The fence is now stripped server-side in
 * `app/api/study/generate/route.ts` and persisted to
 * `generation_metadata.queries` for admin retrieval only.
 *
 * Rendering rules:
 *   - Caller must already have gated this on `isAdmin === true`. The
 *     component itself doesn't do the auth check — that lives at the page
 *     boundary. (Defense-in-depth: if a renderer ever forgets the gate, the
 *     component still doesn't fetch user data, but it WILL show queries.)
 *   - Pre-Phase-1 studies have no `queries` field → render nothing.
 *   - Malformed metadata → render nothing (don't bother the admin with a
 *     parse-error toast for a debug aid).
 */
export function VerificationPanel({ generationMetadata }: VerificationPanelProps) {
  const [open, setOpen] = useState(false);

  if (!generationMetadata) return null;

  let queries: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(generationMetadata) as Partial<StudyGenerationMetadata>;
    if (Array.isArray(parsed.queries)) {
      queries = parsed.queries;
    }
  } catch {
    // Pre-Phase-1 metadata or malformed JSON — silently skip
    return null;
  }

  if (queries.length === 0) return null;

  return (
    <details
      className="my-8 rounded-md border border-[var(--stone-200)] bg-[var(--stone-50)] p-4"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer select-none font-body text-xs font-semibold uppercase tracking-[0.18em] text-[var(--stone-700)]">
        Verification audit ({queries.length} {queries.length === 1 ? 'query' : 'queries'}) — admin only
      </summary>
      {open && (
        <div className="mt-4 space-y-3">
          <p className="font-body text-xs italic text-[var(--stone-500)]">
            The tool calls and queries the LLM emitted while researching this study.
            Stored at generation time, not rendered to public readers.
          </p>
          <pre className="overflow-x-auto rounded bg-[var(--stone-100)] p-3 text-xs leading-relaxed text-[var(--stone-700)]">
            {JSON.stringify(queries, null, 2)}
          </pre>
        </div>
      )}
    </details>
  );
}
