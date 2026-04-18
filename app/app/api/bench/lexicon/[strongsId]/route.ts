import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { getLexiconEntry } from '@/lib/db/lexicon/queries'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 120 })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ strongsId: string }> }
) {
  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { strongsId } = await params

  if (!/^[HG]\d+$/.test(strongsId)) {
    return Response.json({ error: "Invalid Strong's ID format" }, { status: 400 })
  }

  const entry = getLexiconEntry(strongsId)
  return Response.json({ entry })
}
