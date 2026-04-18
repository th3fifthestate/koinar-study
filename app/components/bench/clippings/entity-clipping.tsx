'use client'

import { useState, useEffect } from 'react'
import type { BenchClippingSourceRef } from '@/lib/db/types'

type EntityRef = Extract<BenchClippingSourceRef, { type: 'entity' }>

interface EntityData {
  canonical_name: string
  entity_type: string
  summary: string | null
  quick_glance: string | null
}

interface EntityClippingProps {
  sourceRef: EntityRef | Record<string, unknown>
}

export function EntityClipping({ sourceRef }: EntityClippingProps) {
  const ref = sourceRef as EntityRef
  const { entity_id } = ref
  const [entity, setEntity] = useState<EntityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!entity_id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/entities/${encodeURIComponent(entity_id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { canonical_name?: string; entity_type?: string; summary?: string | null; quick_glance?: string | null } | null) => {
        if (!cancelled && data?.canonical_name) {
          setEntity({
            canonical_name: data.canonical_name,
            entity_type: data.entity_type ?? '',
            summary: data.summary ?? null,
            quick_glance: data.quick_glance ?? null,
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entity_id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-4 h-4 rounded-full border-2 border-sage-300 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!entity) {
    return (
      <p className="text-[12px] text-muted-foreground italic">Entity unavailable</p>
    )
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-[13px] font-semibold text-foreground leading-tight">
          {entity.canonical_name}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-sage-500 ml-2 flex-shrink-0">
          {entity.entity_type}
        </span>
      </div>
      <p className="text-[12px] leading-relaxed text-muted-foreground overflow-hidden line-clamp-5 flex-1">
        {expanded ? (entity.summary ?? entity.quick_glance) : (entity.quick_glance ?? entity.summary)}
      </p>
      {entity.summary && entity.quick_glance && (
        <button
          className="mt-auto text-[11px] text-sage-600 hover:text-sage-800 text-left flex-shrink-0"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : 'Show summary'}
        </button>
      )}
    </div>
  )
}
