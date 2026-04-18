'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { BenchBoard } from '@/lib/db/types'
import { NoBoards } from './empty-states'

interface BoardDashboardProps {
  boards: BenchBoard[]
}

export function BoardDashboard({ boards: initialBoards }: BoardDashboardProps) {
  const router = useRouter()
  const [boards, setBoards] = useState(initialBoards)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  const createBoard = async () => {
    const trimmed = newTitle.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/bench/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (res.ok) {
        const { board } = (await res.json()) as { board: BenchBoard }
        router.push(`/bench/${board.id}`)
      }
    } catch {
      setSaving(false)
    }
  }

  const cancelCreate = () => {
    setCreating(false)
    setNewTitle('')
  }

  if (boards.length === 0 && !creating) {
    return <NoBoards onCreate={() => setCreating(true)} />
  }

  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Study Bench</h1>
        <button
          className="px-4 py-2 rounded-lg bg-sage-600 text-white text-sm font-medium
                     hover:bg-sage-700 transition-colors"
          onClick={() => setCreating(true)}
        >
          + New board
        </button>
      </div>

      {creating && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 px-3 py-2 rounded-lg border border-border text-sm bg-background
                       outline-none focus:ring-1 focus:ring-sage-400"
            placeholder="Board title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createBoard()
              if (e.key === 'Escape') cancelCreate()
            }}
            maxLength={120}
          />
          <button
            className="px-4 py-2 rounded-lg bg-sage-600 text-white text-sm font-medium
                       hover:bg-sage-700 disabled:opacity-50 transition-colors"
            onClick={createBoard}
            disabled={saving || !newTitle.trim()}
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
          <button
            className="px-3 py-2 rounded-lg border border-border text-sm
                       hover:bg-muted transition-colors"
            onClick={cancelCreate}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board) => (
          <a
            key={board.id}
            href={`/bench/${board.id}`}
            className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card
                       hover:bg-muted transition-colors"
          >
            <h2 className="text-[15px] font-semibold text-foreground">{board.title}</h2>
            {board.question && (
              <p className="text-[12px] text-muted-foreground italic line-clamp-2">
                {board.question}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground mt-auto">
              Updated{' '}
              {new Date(board.updated_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </a>
        ))}
      </div>
    </div>
  )
}
