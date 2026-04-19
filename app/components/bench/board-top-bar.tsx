'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { BenchBoard } from '@/lib/db/types'
import { LicenseMeter } from './license-meter'

interface BoardTopBarProps {
  board: BenchBoard
}

export function BoardTopBar({ board }: BoardTopBarProps) {
  const router = useRouter()
  const [title, setTitle] = useState(board.title)
  const [question, setQuestion] = useState(board.question)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  const save = async (patch: Partial<Pick<BenchBoard, 'title' | 'question'>>) => {
    await fetch(`/api/bench/boards/${board.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  const archiveBoard = async () => {
    setMenuOpen(false)
    await fetch(`/api/bench/boards/${board.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: 1 }),
    })
    router.push('/bench')
  }

  return (
    <header
      className="flex-shrink-0 h-14 flex items-center px-4 gap-3 border-b border-border
                 bg-background z-20 relative"
      style={{ minWidth: 0 }}
    >
      {/* Breadcrumb */}
      <Link
        href="/bench"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        ← Boards
      </Link>
      <span className="text-muted-foreground text-sm shrink-0">/</span>

      {/* Title */}
      <input
        className="text-[19px] font-semibold bg-transparent border-none outline-none
                   text-foreground min-w-0 flex-1 focus:bg-muted/30 rounded px-1 -mx-1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const trimmed = title.trim()
          if (trimmed && trimmed !== board.title) save({ title: trimmed })
          else setTitle(board.title)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setTitle(board.title)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        aria-label="Board title"
        maxLength={120}
      />

      {/* Question */}
      <input
        className="text-[15px] italic bg-transparent border-none outline-none
                   text-muted-foreground flex-[2] text-center min-w-0
                   focus:bg-muted/30 rounded px-1 -mx-1"
        value={question}
        placeholder="What are you studying?"
        onChange={(e) => setQuestion(e.target.value)}
        onBlur={() => {
          if (question !== board.question) save({ question })
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setQuestion(board.question)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        aria-label="Board question"
        maxLength={140}
      />

      {/* License meter chips */}
      <LicenseMeter />

      {/* Kebab menu */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center
                     hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Board options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-9 w-44 bg-popover border border-border
                       rounded-lg shadow-md z-50 py-1"
            role="menu"
          >
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-muted
                         text-destructive transition-colors"
              role="menuitem"
              onClick={archiveBoard}
            >
              Archive board
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
