'use client'

import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface NoteSourceRef {
  type: 'note'
  content?: string
}

interface NoteClippingProps {
  clippingId: string
  sourceRef: NoteSourceRef | Record<string, unknown>
}

export function NoteClipping({ clippingId, sourceRef }: NoteClippingProps) {
  const ref = sourceRef as NoteSourceRef
  const initialContent = ref.content ?? ''
  const [editing, setEditing] = useState(initialContent === '')
  const [value, setValue] = useState(initialContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const save = async () => {
    setEditing(false)
    const newRef = JSON.stringify({ type: 'note', content: value })
    try {
      await fetch(`/api/bench/clippings/${clippingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_ref: newRef }),
      })
    } catch {
      // non-fatal — content is kept in local state
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col h-full gap-2">
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none text-[13px] leading-relaxed bg-transparent outline-none
                     text-foreground placeholder:text-muted-foreground"
          placeholder="Write a note… (Markdown supported)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Escape') save()
            // Ctrl/Cmd+Enter also saves
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save()
          }}
          autoFocus
        />
        <button
          className="text-[11px] text-sage-600 hover:text-sage-800 text-right flex-shrink-0"
          onClick={save}
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div
      className="h-full overflow-hidden cursor-text"
      onDoubleClick={() => setEditing(true)}
      title="Double-click to edit"
    >
      {value ? (
        <div className="text-[12px] prose prose-sm max-w-none leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-muted-foreground italic text-[12px]">Double-click to add a note…</p>
      )}
    </div>
  )
}
