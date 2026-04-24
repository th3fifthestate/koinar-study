import { requireAdmin } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { getCachedVerse } from '@/lib/translations/cache'
import { getVerse, normalizeBookName } from '@/lib/db/bible/queries'
import { getBenchBoard } from '@/lib/db/bench/queries'
import { recordFumsEvent } from '@/lib/translations/fums-tracker'
import { TRANSLATIONS } from '@/lib/translations/registry'
import type { TranslationId } from '@/lib/translations/registry'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 240 })

export async function GET(request: Request) {
  const { user, response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const url = new URL(request.url)
  const translation = url.searchParams.get('translation')
  const book = url.searchParams.get('book')
  const chapter = parseInt(url.searchParams.get('chapter') ?? '', 10)
  const verse = parseInt(url.searchParams.get('verse') ?? '', 10)
  const boardId = url.searchParams.get('boardId') ?? ''

  if (!translation || !book || isNaN(chapter) || isNaN(verse) || !boardId) {
    return Response.json(
      { error: 'Missing required params: translation, book, chapter, verse, boardId' },
      { status: 400 }
    )
  }

  // Surface identifier is a compliance signal — verify the board belongs to the user.
  if (!getBenchBoard(boardId, user.userId)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Try translation cache first (handles licensed translations)
  const cached = getCachedVerse(translation, book, chapter, verse)
  if (cached) {
    const tid = translation.toUpperCase() as TranslationId
    if (TRANSLATIONS[tid]?.isLicensed) {
      try {
        recordFumsEvent({
          translation: tid,
          fumsToken: null,
          eventType: 'display',
          userId: user.userId,
          verseCount: 1,
          surface: { kind: 'bench', boardId },
          sessionId: user.sessionId ?? null,
        })
      } catch {
        // Non-fatal — FUMS failure must not block verse delivery
      }
    }
    return Response.json({ text: cached.text, translation, book, chapter, verse })
  }

  // Fall back to BSB local DB for 'bsb' translation
  if (translation === 'bsb') {
    const normalizedBook = normalizeBookName(book)
    if (!normalizedBook) {
      return Response.json({ error: 'Unknown book' }, { status: 404 })
    }
    const verseRow = getVerse(book, chapter, verse)
    if (!verseRow) {
      return Response.json({ error: 'Verse not found' }, { status: 404 })
    }
    return Response.json({ text: verseRow.text, translation, book, chapter, verse })
  }

  // Licensed translation not yet cached — client should prewarm and retry
  return Response.json({ error: 'Verse not cached. Open the board to warm the cache.' }, { status: 503 })
}
