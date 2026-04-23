// app/components/bench/templates/index.ts
export { blank } from './blank'
export { wordStudy } from './word-study'
export { characterStudy } from './character-study'
export { passageStudy } from './passage-study'
export type { TemplateDescriptor, TemplateClipping, TemplateConnection, TemplateId } from './types'

import { blank } from './blank'
import { wordStudy } from './word-study'
import { characterStudy } from './character-study'
import { passageStudy } from './passage-study'
import type { TemplateId, TemplateDescriptor } from './types'

export const TEMPLATES: Record<TemplateId, TemplateDescriptor> = {
  blank,
  'word-study': wordStudy,
  'character-study': characterStudy,
  'passage-study': passageStudy,
}
