import { requireAdmin } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { getCrossRefsFor } from '@/lib/db/cross-refs/queries'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 120 })

export async function GET(request: Request) {
  const { response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const url = new URL(request.url)
  const book = url.searchParams.get('book')
  const chapter = parseInt(url.searchParams.get('chapter') ?? '', 10)
  const verse = parseInt(url.searchParams.get('verse') ?? '', 10)

  if (!book || isNaN(chapter) || isNaN(verse)) {
    return Response.json(
      { error: 'Missing required params: book, chapter, verse' },
      { status: 400 }
    )
  }

  const refs = getCrossRefsFor(book, chapter, verse)
  return Response.json({ refs })
}
