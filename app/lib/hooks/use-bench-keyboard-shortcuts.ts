'use client'
import { useEffect, useRef } from 'react'

interface BenchKeyboardOptions {
  camReset: () => void
  onDuplicate: () => void
  onDelete: () => void
  onUndo: () => void
  onRedo: () => void
  nudge: (dx: number, dy: number) => void
  onOpenExpanded: () => void
  onClearSelection: () => void
  onFocusDrawerSearch: () => void
  onToggleDrawer: () => void
  onToggleTray: () => void
  onOpenCheatSheet: () => void
  isReadOnly: boolean
}

function inEditable(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
}

export function useBenchKeyboardShortcuts(opts: BenchKeyboardOptions): void {
  const ref = useRef(opts)
  ref.current = opts

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (inEditable(e)) return
      const o = ref.current
      const mod = e.metaKey || e.ctrlKey

      // Always available (even read-only and cheat-sheet)
      if (e.key === '?' && !mod) { e.preventDefault(); o.onOpenCheatSheet(); return }
      if (e.key === '[' && !mod) { e.preventDefault(); o.onToggleDrawer(); return }
      if (e.key === ']' && !mod) { e.preventDefault(); o.onToggleTray(); return }
      if (e.key === '/' && !mod) { e.preventDefault(); o.onFocusDrawerSearch(); return }
      if ((e.key === 'f' || e.key === 'F') && !mod) { e.preventDefault(); o.camReset(); return }

      if (o.isReadOnly) return

      if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); o.onRedo(); return }
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); o.onUndo(); return }
      if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); o.onDuplicate(); return }
      if (mod && (e.key === 's' || e.key === 'S')) { e.preventDefault(); return } // reserved no-op

      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); o.onDelete(); return }
      if (e.key === 'Enter') { e.preventDefault(); o.onOpenExpanded(); return }
      if (e.key === 'Escape') { o.onClearSelection(); return }

      const NUDGE = e.shiftKey ? 32 : 8
      if (e.key === 'ArrowUp')    { e.preventDefault(); o.nudge(0, -NUDGE); return }
      if (e.key === 'ArrowDown')  { e.preventDefault(); o.nudge(0, NUDGE); return }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); o.nudge(-NUDGE, 0); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); o.nudge(NUDGE, 0); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
