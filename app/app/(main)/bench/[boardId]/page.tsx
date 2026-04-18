import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import {
  getBenchBoard,
  getBenchClippings,
  getBenchConnections,
  getRecentVerseSeeds,
} from '@/lib/db/bench/queries'
import { prewarmBoard } from '@/lib/bench/prewarm'
import { BenchCanvas } from '@/components/bench/canvas'
import { BoardTopBar } from '@/components/bench/board-top-bar'
import { SourceDrawer } from '@/components/bench/source-drawer'
import { RecentClipsTray } from '@/components/bench/recent-clips-tray'
import { EmptyCanvas, MobileNotice } from '@/components/bench/empty-states'
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

  const board = getBenchBoard(boardId, session.userId)
  if (!board) notFound()

  // Prewarm verse cache before passing to client (non-fatal on error)
  await prewarmBoard(boardId)

  const clippings = getBenchClippings(boardId)
  const connections = getBenchConnections(boardId)
  const verseSeeds = getRecentVerseSeeds(session.userId, 10)

  const isEmpty = clippings.length === 0

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <MobileNotice />
      <BoardTopBar board={board} />
      <div className="flex flex-1 min-h-0">
        <SourceDrawer verseSeeds={verseSeeds} boardId={boardId} />
        <main className="flex-1 relative min-w-0 overflow-hidden">
          <BenchCanvas
            board={board}
            initialClippings={clippings}
            initialConnections={connections}
          />
          {isEmpty && <EmptyCanvas />}
        </main>
        <RecentClipsTray />
      </div>
    </div>
  )
}
