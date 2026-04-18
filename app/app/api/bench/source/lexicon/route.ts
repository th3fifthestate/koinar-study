import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { searchLexicon } from '@/lib/db/lexicon/queries'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 120 })

export async function GET(request: Request) {
  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const language = url.searchParams.get('language')

  if (!q.trim() || q.length > 100) {
    return Response.json({ entries: [] })
  }

  const lang =
    language === 'hebrew' || language === 'greek' ? language : undefined

  const entries = searchLexicon(q, lang, 25)
  return Response.json({ entries })
}
