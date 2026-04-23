'use client'

import type { BenchClipping } from '@/lib/db/types'
import type { BenchOpenDrawerEvent } from '../source-drawer'

// Maps clipping type to the matching Source Drawer tab
const TYPE_TO_TAB: Record<
  BenchClipping['clipping_type'],
  'verses' | 'entities' | 'lexicon' | 'cross-refs' | 'notes' | 'studies'
> = {
  verse: 'verses',
  entity: 'entities',
  lexicon: 'lexicon',
  'cross-ref-chain': 'cross-refs',
  note: 'notes',
  'study-section': 'studies',
  'translation-compare': 'verses',
}

const TYPE_LABEL: Record<BenchClipping['clipping_type'], string> = {
  verse: 'Verse',
  entity: 'Person / Place / Thing',
  'translation-compare': 'Translation Compare',
  'cross-ref-chain': 'Cross-References',
  lexicon: 'Lexicon Entry',
  note: 'Note',
  'study-section': 'Study Section',
}

interface PlaceholderCardProps {
  body: string
  type: BenchClipping['clipping_type']
}

export function PlaceholderCard({ body, type }: PlaceholderCardProps) {
  const openDrawer = () => {
    const event: BenchOpenDrawerEvent = new CustomEvent('bench:open-drawer', {
      detail: { tab: TYPE_TO_TAB[type] },
    })
    window.dispatchEvent(event)
  }

  return (
    <button
      className="flex flex-col w-full h-full gap-2 p-3 rounded-lg text-left
                 border border-dashed border-sage-300
                 hover:border-sage-400 hover:bg-sage-50/50 transition-colors"
      onClick={openDrawer}
      aria-label={`Open source drawer to add a ${TYPE_LABEL[type]}`}
    >
      <span className="text-[10px] font-semibold tracking-wide uppercase text-sage-500">
        {TYPE_LABEL[type]}
      </span>
      {body && (
        <p className="flex-1 flex items-center justify-center text-[14px] text-stone-500 text-center leading-relaxed">
          {body}
        </p>
      )}
    </button>
  )
}
