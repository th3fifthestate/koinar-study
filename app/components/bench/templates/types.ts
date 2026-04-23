// app/components/bench/templates/types.ts
import type { BenchClipping } from '@/lib/db/types'

export type TemplateId = 'blank' | 'word-study' | 'character-study' | 'passage-study'

export interface TemplateClipping {
  placeholder_id: string
  clipping_type: BenchClipping['clipping_type']
  x: number
  y: number
  width: number
  height: number
  placeholder_body?: string
  seed_source_ref?: Record<string, unknown>
}

export interface TemplateConnection {
  from_placeholder_id: string
  to_placeholder_id: string
  label?: string
  bidirectional?: boolean
}

export interface TemplateDescriptor {
  id: TemplateId
  title: string
  subtitle: string
  description: string
  clippings: TemplateClipping[]
  connections: TemplateConnection[]
}
