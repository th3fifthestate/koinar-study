// app/components/bench/templates/passage-study.ts
import type { TemplateDescriptor } from './types'

export const passageStudy: TemplateDescriptor = {
  id: 'passage-study',
  title: 'Passage Study',
  subtitle: 'One passage, held slowly.',
  description: 'For questions like "what is Romans 12 asking of me?" or "how does Psalm 23 hold together?"',
  clippings: [
    { placeholder_id: 'verse-top',           clipping_type: 'verse',               x: -280, y: -260, width: 560, height: 120, placeholder_body: 'The passage.' },
    { placeholder_id: 'translation-compare', clipping_type: 'translation-compare', x: -280, y: -110, width: 560, height: 240, placeholder_body: 'Drop the passage here to compare translations.', seed_source_ref: { translations: ['bsb', 'niv'] } },
    { placeholder_id: 'cross-ref-chain',     clipping_type: 'cross-ref-chain',     x:  340, y: -260, width: 320, height: 400, placeholder_body: 'Drop the passage here to see the cross-references that fan out.' },
    { placeholder_id: 'note-context',        clipping_type: 'note',                x: -580, y:  160, width: 280, height: 240, placeholder_body: 'What do you need to know before reading?' },
    { placeholder_id: 'note-claims',         clipping_type: 'note',                x: -280, y:  160, width: 560, height: 240, placeholder_body: 'What is this passage claiming?' },
    { placeholder_id: 'note-leads',          clipping_type: 'note',                x:  340, y:  160, width: 320, height: 240, placeholder_body: 'Where does this lead me?' },
  ],
  connections: [
    { from_placeholder_id: 'verse-top', to_placeholder_id: 'translation-compare', label: 'translations' },
    { from_placeholder_id: 'verse-top', to_placeholder_id: 'cross-ref-chain',     label: 'cross-refs' },
    { from_placeholder_id: 'verse-top', to_placeholder_id: 'note-context' },
    { from_placeholder_id: 'verse-top', to_placeholder_id: 'note-claims' },
    { from_placeholder_id: 'verse-top', to_placeholder_id: 'note-leads' },
  ],
}
