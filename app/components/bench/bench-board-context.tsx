'use client'

// app/components/bench/bench-board-context.tsx
import { createContext, useContext, useMemo } from 'react'
import { useBenchBoard } from '@/lib/hooks/use-bench-board'
import { useViewportSize } from '@/lib/hooks/use-viewport-size'
import type { BenchClipping, BenchConnection } from '@/lib/db/types'

type BenchBoardState = ReturnType<typeof useBenchBoard> & { isReadOnly: boolean }

const BenchBoardContext = createContext<BenchBoardState | null>(null)

export function useBenchBoardContext(): BenchBoardState {
  const ctx = useContext(BenchBoardContext)
  if (!ctx) throw new Error('useBenchBoardContext must be used inside BenchBoardProvider')
  return ctx
}

interface BenchBoardProviderProps {
  boardId: string
  initialClippings: BenchClipping[]
  initialConnections: BenchConnection[]
  children: React.ReactNode
}

export function BenchBoardProvider({
  boardId,
  initialClippings,
  initialConnections,
  children,
}: BenchBoardProviderProps) {
  const state = useBenchBoard(boardId, initialClippings, initialConnections)
  const viewport = useViewportSize()
  const isReadOnly = viewport === 'mobile'
  const value = useMemo(() => ({ ...state, isReadOnly }), [state, isReadOnly])
  return (
    <BenchBoardContext.Provider value={value}>
      {children}
    </BenchBoardContext.Provider>
  )
}
