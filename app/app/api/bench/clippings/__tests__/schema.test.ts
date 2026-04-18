import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Mirror the source_ref schema from route.ts to test validation directly
const sourceRefSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('verse'),
    book: z.string().min(1),
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
    translation: z.string().min(1),
  }),
  z.object({
    type: z.literal('entity'),
    entity_id: z.string().min(1),
  }),
  z.object({
    type: z.literal('note'),
    content: z.string().max(10000).optional().default(''),
  }),
  z.object({
    type: z.literal('translation-compare'),
    book: z.string().min(1),
    chapter: z.number().int().positive(),
    verse: z.number().int().positive(),
    translations: z.array(z.string().min(1)).min(2).max(4),
  }),
  z.object({
    type: z.literal('cross-ref-chain'),
    from_book: z.string().min(1),
    from_chapter: z.number().int().positive(),
    from_verse: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('lexicon'),
    strongs_id: z.string().min(1),
  }),
  z.object({
    type: z.literal('study-section'),
    study_id: z.number().int().positive(),
    section_heading: z.string().min(1).max(200),
  }),
])

describe('clipping sourceRefSchema — new types', () => {
  describe('translation-compare', () => {
    it('accepts valid payload with 2 translations', () => {
      const result = sourceRefSchema.safeParse({
        type: 'translation-compare',
        book: 'John',
        chapter: 3,
        verse: 16,
        translations: ['bsb', 'kjv'],
      })
      expect(result.success).toBe(true)
    })

    it('accepts up to 4 translations', () => {
      const result = sourceRefSchema.safeParse({
        type: 'translation-compare',
        book: 'Gen',
        chapter: 1,
        verse: 1,
        translations: ['bsb', 'kjv', 'web', 'nlt'],
      })
      expect(result.success).toBe(true)
    })

    it('rejects only 1 translation', () => {
      const result = sourceRefSchema.safeParse({
        type: 'translation-compare',
        book: 'John',
        chapter: 3,
        verse: 16,
        translations: ['bsb'],
      })
      expect(result.success).toBe(false)
    })

    it('rejects more than 4 translations', () => {
      const result = sourceRefSchema.safeParse({
        type: 'translation-compare',
        book: 'John',
        chapter: 3,
        verse: 16,
        translations: ['bsb', 'kjv', 'web', 'nlt', 'nasb'],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('cross-ref-chain', () => {
    it('accepts valid payload', () => {
      const result = sourceRefSchema.safeParse({
        type: 'cross-ref-chain',
        from_book: 'Romans',
        from_chapter: 8,
        from_verse: 28,
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing from_verse', () => {
      const result = sourceRefSchema.safeParse({
        type: 'cross-ref-chain',
        from_book: 'Romans',
        from_chapter: 8,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('lexicon', () => {
    it('accepts valid strongs_id', () => {
      const result = sourceRefSchema.safeParse({ type: 'lexicon', strongs_id: 'H0001' })
      expect(result.success).toBe(true)
    })

    it('rejects empty strongs_id', () => {
      const result = sourceRefSchema.safeParse({ type: 'lexicon', strongs_id: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('study-section', () => {
    it('accepts valid payload', () => {
      const result = sourceRefSchema.safeParse({
        type: 'study-section',
        study_id: 42,
        section_heading: 'the-call-of-abraham',
      })
      expect(result.success).toBe(true)
    })

    it('rejects study_id of 0', () => {
      const result = sourceRefSchema.safeParse({
        type: 'study-section',
        study_id: 0,
        section_heading: 'intro',
      })
      expect(result.success).toBe(false)
    })

    it('rejects section_heading over 200 chars', () => {
      const result = sourceRefSchema.safeParse({
        type: 'study-section',
        study_id: 1,
        section_heading: 'a'.repeat(201),
      })
      expect(result.success).toBe(false)
    })
  })
})
