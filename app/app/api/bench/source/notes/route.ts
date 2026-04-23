import { requireAdmin } from '@/lib/auth/middleware'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { getDb } from '@/lib/db/connection'

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 120 })

export async function GET(request: Request) {
  const { user, response } = await requireAdmin()
  if (response) return response

  const ip = getClientIp(request)
  if (isRateLimited(ip)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''

  if (!q.trim() || q.trim().length < 2 || q.length > 200) {
    return Response.json({ notes: [] })
  }

  const escaped = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  const pattern = `%${escaped}%`

  const rows = getDb()
    .prepare(
      `SELECT id, study_id, note_text, selected_text, color, created_at
       FROM annotations
       WHERE user_id = ? AND type = 'note'
         AND (note_text LIKE ? ESCAPE '\\' OR selected_text LIKE ? ESCAPE '\\')
       ORDER BY created_at DESC
       LIMIT 25`
    )
    .all(user.userId, pattern, pattern) as Array<{
      id: number
      study_id: number
      note_text: string | null
      selected_text: string
      color: string
      created_at: string
    }>

  const notes = rows.map((r) => ({
    annotation_id: r.id,
    study_id: r.study_id,
    note_text: r.note_text,
    selected_text: r.selected_text,
    color: r.color,
    created_at: r.created_at,
  }))

  return Response.json({ notes })
}
