// app/components/bench/templates/word-study.ts
import type { TemplateDescriptor } from './types'

export const wordStudy: TemplateDescriptor = {
  id: 'word-study',
  title: 'Word Study',
  subtitle: 'Follow a word across scripture.',
  description: 'For questions like "what does shalom mean?" or "where does ἀγάπη appear?"',
  clippings: [
    { placeholder_id: 'lexicon-center', clipping_type: 'lexicon',             x: -140, y:  -90, width: 280, height: 180, placeholder_body: "Drop a Strong's entry here." },
    { placeholder_id: 'verse-1',        clipping_type: 'verse',               x: -340, y: -220, width: 280, height: 120, placeholder_body: 'Occurrence 1' },
    { placeholder_id: 'verse-2',        clipping_type: 'verse',               x:   60, y: -220, width: 280, height: 120, placeholder_body: 'Occurrence 2' },
    { placeholder_id: 'verse-3',        clipping_type: 'verse',               x: -340, y:   60, width: 280, height: 120, placeholder_body: 'Occurrence 3' },
    { placeholder_id: 'tc-right',       clipping_type: 'translation-compare', x:  420, y:  -80, width: 560, height: 240, placeholder_body: 'Drop one of the verses here to see it in 2–4 translations side by side.' },
    { placeholder_id: 'note-bottom',    clipping_type: 'note',                x: -140, y:  260, width: 560, height: 160, placeholder_body: "What are you noticing about this word's range?" },
  ],
  connections: [
    { from_placeholder_id: 'lexicon-center', to_placeholder_id: 'verse-1' },
    { from_placeholder_id: 'lexicon-center', to_placeholder_id: 'verse-2' },
    { from_placeholder_id: 'lexicon-center', to_placeholder_id: 'verse-3' },
  ],
}
