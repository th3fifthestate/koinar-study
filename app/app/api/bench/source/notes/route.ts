import { requireAuth } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { getDb } from '@/lib/db/connection'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 120 })

export async function GET(request: Request) {
  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { user, response } = await requireAuth()
  if (response) return response

  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''

  if (!q.trim() || q.trim().length < 2 || q.length > 200) {
    return Response.json({ notes: [] })
  }

  const escaped = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  const pattern = `%${escaped}%`

  const notes = getDb()
    .prepare(
      `SELECT id, study_id, note_text, selected_text, color, created_at
       FROM annotations
       WHERE user_id = ? AND type = 'note'
         AND (note_text LIKE ? ESCAPE '\\' OR selected_text LIKE ? ESCAPE '\\')
       ORDER BY created_at DESC
       LIMIT 25`
    )
    .all(String(user.userId), pattern, pattern)

  return Response.json({ notes })
}
