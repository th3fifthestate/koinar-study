'use client'

// app/components/bench/bench-page.tsx
import { BenchBoardProvider } from './bench-board-context'
import { BenchCanvas } from './canvas'
import { BoardTopBar } from './board-top-bar'
import { SourceDrawer } from './source-drawer'
import { RecentClipsTray } from './recent-clips-tray'
import { EmptyCanvas, MobileNotice } from './empty-states'
import { MobileReadOnlyBanner } from './empty-states/mobile-readonly-banner'
import { CopyCapRoot } from './copy-cap-root'
import { useViewportSize } from '@/lib/hooks/use-viewport-size'
import type { BenchBoard, BenchClipping, BenchConnection } from '@/lib/db/types'

interface BenchPageProps {
  board: BenchBoard
  initialClippings: BenchClipping[]
  initialConnections: BenchConnection[]
  verseSeeds: Array<{ source_ref: string; created_at: string }>
  prewarmFailed: boolean
}

export function BenchPage({
  board,
  initialClippings,
  initialConnections,
  verseSeeds,
  prewarmFailed,
}: BenchPageProps) {
  const isEmpty = initialClippings.length === 0
  const viewport = useViewportSize()

  return (
    <BenchBoardProvider
      boardId={board.id}
      initialClippings={initialClippings}
      initialConnections={initialConnections}
    >
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {viewport === 'mobile' && <MobileReadOnlyBanner />}
        <MobileNotice />
        <BoardTopBar board={board} />
        <div className="flex flex-1 min-h-0">
          <SourceDrawer verseSeeds={verseSeeds} boardId={board.id} />
          <CopyCapRoot
            surface={{ kind: 'bench', boardId: board.id }}
            className="flex-1 relative min-w-0 overflow-hidden"
          >
            <BenchCanvas board={board} />
            {isEmpty && <EmptyCanvas />}
          </CopyCapRoot>
          <RecentClipsTray />
        </div>
        {prewarmFailed && (
          <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
                       bg-amber-50 border border-amber-200 text-amber-800 text-[13px]
                       rounded-lg px-4 py-3 shadow-md"
            role="status"
          >
            <span>Some verse translations may not load — the verse cache didn't warm up.</span>
            <button
              className="font-medium underline underline-offset-2 hover:no-underline"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </BenchBoardProvider>
  )
}
