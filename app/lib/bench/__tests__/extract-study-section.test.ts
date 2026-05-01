import { describe, it, expect } from 'vitest'
import { slugify, extractSection } from '../extract-study-section'

const MD = `# Introduction

Opening paragraph.

## The Call of Abraham

God called Abraham out of Ur.

### A Sub-heading

Detail here.

## The Covenant

God established a covenant.
`

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('The Call of Abraham')).toBe('the-call-of-abraham')
  })

  // Apostrophe becomes a hyphen — matches the canonical slugifyHeading rule
  // used by the reader's TOC, so bench section lookups don't drift.
  it('replaces apostrophes with hyphen separator', () => {
    expect(slugify("God's Plan")).toBe('god-s-plan')
  })

  it('handles numeric prefixes', () => {
    expect(slugify('1 Kings Overview')).toBe('1-kings-overview')
  })

  // Parenthetical tails are stripped (canonical reader rule) — heading
  // "The Fisherman's Calling (Matthew 4:18-20)" must produce the same slug
  // whether the bench or the reader is computing it.
  it('strips parenthetical tails', () => {
    expect(slugify("The Fisherman's Calling (Matthew 4:18-20)")).toBe(
      'the-fisherman-s-calling',
    )
  })
})

describe('extractSection', () => {
  it('returns section content for a matching h2', () => {
    const result = extractSection(MD, 'the-call-of-abraham')
    expect(result).toContain('God called Abraham out of Ur.')
    expect(result).toContain('A Sub-heading')
    expect(result).toContain('Detail here.')
  })

  it('stops at the next h2', () => {
    const result = extractSection(MD, 'the-call-of-abraham')
    expect(result).not.toContain('God established a covenant.')
  })

  it('includes the heading line itself', () => {
    const result = extractSection(MD, 'the-call-of-abraham')
    expect(result).toContain('## The Call of Abraham')
  })

  it('returns null when slug not found', () => {
    expect(extractSection(MD, 'missing-heading')).toBeNull()
  })

  it('matches h3 headings', () => {
    const result = extractSection(MD, 'a-sub-heading')
    expect(result).toContain('Detail here.')
    expect(result).not.toContain('God established a covenant.')
  })
})
