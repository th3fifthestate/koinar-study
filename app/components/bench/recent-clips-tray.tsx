'use client'

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { RecentClipsEmptyState } from './empty-states/recent-clips-empty-state'

interface RecentClip {
  id: string
  user_id: string
  payload: string
  clipped_from_route: string | null
  created_at: string
}

function groupByDate(clips: RecentClip[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekAgo = new Date(today.getTime() - 6 * 86400000)
  return clips.reduce(
    (acc, c) => {
      const t = new Date(c.created_at)
      if (t >= today) acc.today.push(c)
      else if (t >= weekAgo) acc.week.push(c)
      else acc.older.push(c)
      return acc
    },
    { today: [] as RecentClip[], week: [] as RecentClip[], older: [] as RecentClip[] }
  )
}

function clipLabel(payload: string): string {
  try {
    const { type, source_ref: sr } = JSON.parse(payload) as {
      type: string
      source_ref: Record<string, unknown>
    }
    switch (type) {
      case 'verse':
        return `${String(sr.book)} ${String(sr.chapter)}:${String(sr.verse)} (${String(sr.translation).toUpperCase()})`
      case 'entity':
        return 'Entity'
      case 'translation-compare':
        return `Compare ${String(sr.book)} ${String(sr.chapter)}:${String(sr.verse)}`
      case 'cross-ref-chain':
        return `Cross-refs: ${String(sr.from_book)} ${String(sr.from_chapter)}:${String(sr.from_verse)}`
      case 'lexicon':
        return `Lexicon: ${String(sr.strongs_id)}`
      case 'note':
        return 'Note'
      case 'study-section':
        return 'Study section'
      default:
        return 'Clip'
    }
  } catch {
    return 'Clip'
  }
}

export function RecentClipsTray() {
  const [expanded, setExpanded] = useState(false)
  const [clips, setClips] = useState<RecentClip[]>([])
  const [loading, setLoading] = useState(false)

  const fetchClips = useCallback(() => {
    setLoading(true)
    fetch('/api/bench/recent-clips')
      .then((r) => r.json())
      .then((d: { clips?: RecentClip[] }) => {
        setClips(d.clips ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchClips()
  }, [fetchClips])

  const dismiss = async (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id))
    await fetch(`/api/bench/recent-clips/${id}`, { method: 'DELETE' })
  }

  const groups = groupByDate(clips)
  const sections = [
    { key: 'today', label: 'Today', items: groups.today },
    { key: 'week', label: 'This Week', items: groups.week },
    { key: 'older', label: 'Older', items: groups.older },
  ] as const

  return (
    <aside
      className={`flex-shrink-0 h-full bg-background border-l border-border overflow-hidden flex flex-col transition-[width] duration-[220ms] ease-out ${
        expanded ? 'w-[280px]' : 'w-12'
      }`}
      aria-label="Recent clips tray"
    >
      {/* Toggle button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="relative h-12 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 w-full"
        aria-label={expanded ? 'Collapse recent clips' : 'Expand recent clips'}
      >
        {/* Inbox icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-6l-2 3H10l-2-3H2" />
          <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
        </svg>
        {clips.length > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-sage-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {clips.length > 9 ? '9+' : clips.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-3 flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : clips.length === 0 ? (
            <RecentClipsEmptyState />
          ) : (
            sections.map(({ key, label, items }) =>
              items.length > 0 ? (
                <div key={key}>
                  <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted sticky top-0">
                    {label}
                  </p>
                  {items.map((clip) => {
                    let parsed: { type: string; source_ref: Record<string, unknown> } | null = null
                    try {
                      parsed = JSON.parse(clip.payload)
                    } catch {
                      return null
                    }
                    if (!parsed) return null

                    const dragPayload = JSON.stringify({
                      clipping_type: parsed.type,
                      source_ref: parsed.source_ref,
                      recent_clip_id: clip.id,
                    })

                    return (
                      <div
                        key={clip.id}
                        draggable
                        onDragStart={(e) =>
                          e.dataTransfer.setData('application/bench-clip', dragPayload)
                        }
                        className="group flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted cursor-grab active:cursor-grabbing border-b border-border/40"
                      >
                        <span className="text-[12px] text-foreground truncate">
                          {clipLabel(clip.payload)}
                        </span>
                        <button
                          onClick={() => void dismiss(clip.id)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                          aria-label="Dismiss"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : null
            )
          )}
        </div>
      )}

      {/* Collapsed label */}
      {!expanded && (
        <div className="flex-1 flex items-center justify-center pointer-events-none select-none">
          <span
            className="text-[10px] text-muted-foreground tracking-widest uppercase"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Recent
          </span>
        </div>
      )}
    </aside>
  )
}
