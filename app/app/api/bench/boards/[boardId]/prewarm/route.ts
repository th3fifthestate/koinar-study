import { requireAuth } from '@/lib/auth/middleware'
import { getBenchBoard } from '@/lib/db/bench/queries'
import { prewarmBoard } from '@/lib/bench/prewarm'

interface Props {
  params: Promise<{ boardId: string }>
}

export async function POST(_request: Request, { params }: Props) {
  const { user, response } = await requireAuth()
  if (response) return response

  const { boardId } = await params
  const board = getBenchBoard(boardId, user.userId)
  if (!board) return Response.json({ error: 'Not found' }, { status: 404 })

  await prewarmBoard(boardId)
  return Response.json({ ok: true })
}
