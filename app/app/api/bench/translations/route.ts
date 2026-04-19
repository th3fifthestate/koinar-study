import { requireAuth } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { fetchVerseText } from '@/lib/bench/fetch-verse-text'
import { recordFumsEvent } from '@/lib/translations/fums-tracker'
import { TRANSLATIONS } from '@/lib/translations/registry'
import type { TranslationId } from '@/lib/translations/registry'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 120 })

export async function GET(request: Request) {
  const { user, response } = await requireAuth()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const url = new URL(request.url)
  const book = url.searchParams.get('book')
  const chapter = parseInt(url.searchParams.get('chapter') ?? '', 10)
  const verse = parseInt(url.searchParams.get('verse') ?? '', 10)
  const translationsParam = url.searchParams.get('translations')
  const boardId = url.searchParams.get('boardId') ?? ''

  if (!book || isNaN(chapter) || isNaN(verse) || !translationsParam) {
    return Response.json(
      { error: 'Missing required params: book, chapter, verse, translations' },
      { status: 400 }
    )
  }

  const ids = translationsParam.split(',').slice(0, 4).map(t => t.trim()).filter(Boolean)
  if (ids.length < 2) {
    return Response.json({ error: 'Provide at least 2 translation IDs' }, { status: 400 })
  }

  const translations = await Promise.all(
    ids.map(async id => ({
      id,
      text: await fetchVerseText(id, book, chapter, verse).catch(() => null),
    }))
  )

  // Fire one FUMS display event per licensed translation successfully served
  for (const { id, text } of translations) {
    if (!text) continue
    const tid = id.toUpperCase() as TranslationId
    if (!TRANSLATIONS[tid]?.isLicensed) continue
    try {
      recordFumsEvent({
        translation: tid,
        fumsToken: null,
        eventType: 'display',
        userId: user.userId,
        verseCount: 1,
        surface: { kind: 'bench', boardId },
      })
    } catch {
      // Non-fatal — FUMS failure must not block response
    }
  }

  return Response.json({ translations, book, chapter, verse })
}
