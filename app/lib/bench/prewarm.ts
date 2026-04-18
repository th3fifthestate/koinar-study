// app/lib/bench/prewarm.ts
//
// Best-effort translation cache pre-warm for a Study Bench board.
// Called when a board is opened; non-fatal on any failure.

import { getDb } from '@/lib/db/connection'
import type { BenchClipping, BenchClippingSourceRef } from '@/lib/db/types'
import { getCachedVerse } from '@/lib/translations/cache'

export async function prewarmBoard(boardId: string): Promise<void> {
  try {
    const db = getDb()
    const clippings = db
      .prepare('SELECT id, clipping_type, source_ref FROM bench_clippings WHERE board_id = ?')
      .all(boardId) as Pick<BenchClipping, 'id' | 'clipping_type' | 'source_ref'>[]

    for (const clip of clippings) {
      if (clip.clipping_type !== 'verse') continue
      try {
        const ref = JSON.parse(clip.source_ref) as BenchClippingSourceRef
        if (ref.type !== 'verse') continue
        getCachedVerse(ref.translation, ref.book, ref.chapter, ref.verse)
      } catch (err) {
        // Non-fatal: individual clipping parse/cache error — skip and continue
        console.warn('[prewarm] skipping clipping', clip.id, err)
      }
    }
  } catch (err) {
    // Non-fatal: canvas still renders; client retries on miss
    console.warn('[prewarm] board pre-warm failed', boardId, err)
  }
}
