// Re-export the canonical reader slug so bench section lookups produce the
// same slug the reader uses for the same heading. Without this, a heading
// like "Self-control" yields different slugs in the two paths and the bench
// section-pull silently misses.
export { slugifyHeading as slugify } from '@/lib/reader/slugify-heading'
import { slugifyHeading } from '@/lib/reader/slugify-heading'

export function extractSection(markdown: string, headingSlug: string): string | null {
  const lines = markdown.split('\n')
  let inSection = false
  const sectionLines: string[] = []

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/)
    const h3 = line.match(/^###\s+(.+)$/)
    const match = h2 || h3

    if (match) {
      if (inSection && h2) break // next h2 closes the section
      if (slugifyHeading(match[1]) === headingSlug) {
        inSection = true
      }
    }

    if (inSection) sectionLines.push(line)
  }

  return sectionLines.length > 0 ? sectionLines.join('\n').trim() : null
}
