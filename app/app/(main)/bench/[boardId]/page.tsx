import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import {
  getBenchBoard,
  getBenchClippings,
  getBenchConnections,
  getRecentVerseSeeds,
} from '@/lib/db/bench/queries'
import { prewarmBoard } from '@/lib/bench/prewarm'
import { getUserFlags } from '@/lib/bench/user-flags'
import { BenchPage } from '@/components/bench/bench-page'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ boardId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { boardId } = await params
  const session = await getCurrentUser()
  if (!session) return { title: 'Study Bench' }
  const board = getBenchBoard(boardId, session.userId)
  if (!board) return { title: 'Board not found — Study Bench' }
  return {
    title: `${board.title} — Study Bench`,
    description: board.question || undefined,
  }
}

export default async function BoardPage({ params }: Props) {
  const { boardId } = await params

  const session = await getCurrentUser()
  if (!session) redirect('/login')
  if (!session.isAdmin) redirect('/')

  const board = getBenchBoard(boardId, session.userId)
  if (!board) notFound()

  const prewarmFailed = await prewarmBoard(boardId).then(() => false).catch(() => true)

  const clippings = getBenchClippings(boardId)
  const connections = getBenchConnections(boardId)
  const verseSeeds = getRecentVerseSeeds(session.userId, 10)
  const flags = getUserFlags(session.userId)

  return (
    <BenchPage
      board={board}
      initialClippings={clippings}
      initialConnections={connections}
      verseSeeds={verseSeeds}
      prewarmFailed={prewarmFailed}
      hasDrawnFirstConnection={flags.has_drawn_first_connection === 1}
    />
  )
}
