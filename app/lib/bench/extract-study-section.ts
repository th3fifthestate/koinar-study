export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/-/g, ' ')           // treat hyphens as word separators before stripping
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

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
      if (slugify(match[1]) === headingSlug) {
        inSection = true
      }
    }

    if (inSection) sectionLines.push(line)
  }

  return sectionLines.length > 0 ? sectionLines.join('\n').trim() : null
}
