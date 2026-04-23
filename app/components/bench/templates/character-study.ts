// app/components/bench/templates/character-study.ts
import type { TemplateDescriptor } from './types'

export const characterStudy: TemplateDescriptor = {
  id: 'character-study',
  title: 'Character Study',
  subtitle: 'A person, their verses, the people in their orbit.',
  description: 'For questions like "what kind of leader was Caleb?" or "who is Ruth becoming?"',
  clippings: [
    { placeholder_id: 'entity-center',      clipping_type: 'entity', x: -160, y:  -90, width: 320, height: 180, placeholder_body: 'Drop the person here.' },
    { placeholder_id: 'verse-r',            clipping_type: 'verse',  x:  200, y:  -60, width: 280, height: 120, placeholder_body: 'Verse 1' },
    { placeholder_id: 'verse-ur',           clipping_type: 'verse',  x:   30, y: -354, width: 280, height: 120, placeholder_body: 'Verse 2' },
    { placeholder_id: 'verse-ul',           clipping_type: 'verse',  x: -310, y: -354, width: 280, height: 120, placeholder_body: 'Verse 3' },
    { placeholder_id: 'verse-l',            clipping_type: 'verse',  x: -480, y:  -60, width: 280, height: 120, placeholder_body: 'Verse 4' },
    { placeholder_id: 'verse-ll',           clipping_type: 'verse',  x: -310, y:  234, width: 280, height: 120, placeholder_body: 'Verse 5' },
    { placeholder_id: 'verse-lr',           clipping_type: 'verse',  x:   30, y:  234, width: 280, height: 120, placeholder_body: 'Verse 6' },
    { placeholder_id: 'note-relationships', clipping_type: 'note',   x: -780, y: -240, width: 280, height: 240, placeholder_body: 'Who is this person connected to, and how? (Mentor, rival, spouse, adversary…)' },
    { placeholder_id: 'note-synthesis',     clipping_type: 'note',   x: -140, y:  280, width: 560, height: 160, placeholder_body: "What is the shape of this person's life from the verses above?" },
  ],
  connections: [
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-r' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-ur' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-ul' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-l' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-ll' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'verse-lr' },
    { from_placeholder_id: 'entity-center', to_placeholder_id: 'note-relationships', bidirectional: true },
  ],
}
