'use client'

import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { BenchClippingSourceRef } from '@/lib/db/types'

type StudySectionRef = Extract<BenchClippingSourceRef, { type: 'study-section' }>

interface StudySectionClippingProps {
  sourceRef: StudySectionRef | Record<string, unknown>
}

interface SectionData {
  content: string | null
  heading: string | null
  study_slug: string | null
}

export function StudySectionClipping({ sourceRef }: StudySectionClippingProps) {
  const ref = sourceRef as StudySectionRef
  const { study_id, section_heading } = ref

  const [data, setData] = useState<SectionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!study_id || !section_heading) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(
      `/api/bench/study-section?study_id=${study_id}&heading_slug=${encodeURIComponent(section_heading)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: SectionData | null) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [study_id, section_heading])

  const openStudy = () => {
    const base = data?.study_slug ? `/study/${data.study_slug}` : `/study/${study_id}`
    window.open(`${base}#${section_heading}`, '_blank')
  }

  const displayHeading = data?.heading ?? section_heading

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <button
          onClick={openStudy}
          className="flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-sage-700 group min-w-0"
        >
          <span className="truncate">{displayHeading}</span>
          <ExternalLink
            size={11}
            className="shrink-0 text-muted-foreground/40 group-hover:text-sage-500"
          />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2">
        {loading ? (
          <div className="flex flex-col gap-2 pt-2">
            {[80, 65, 90, 55].map((w, i) => (
              <div
                key={i}
                className="h-4 animate-pulse bg-muted rounded"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        ) : data?.content ? (
          <div className="prose prose-sm prose-stone max-w-none text-xs leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground italic pt-2">Section not found.</p>
        )}
      </div>
    </div>
  )
}
