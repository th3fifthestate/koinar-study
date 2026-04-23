import { getCachedVerse } from '@/lib/translations/cache'
import { getVerse } from '@/lib/db/bible/queries'

/**
 * Returns the text for a single verse in the given translation.
 * Returns null if the verse is not found or not yet cached.
 */
export async function fetchVerseText(
  translation: string,
  book: string,
  chapter: number,
  verse: number
): Promise<string | null> {
  const upper = translation.toUpperCase()

  // Check the translation cache first (covers licensed translations)
  const cached = getCachedVerse(upper, book, chapter, verse)
  if (cached) return cached.text

  // BSB is always available from the local DB
  if (upper === 'BSB') {
    const row = getVerse(book, chapter, verse)
    return row?.text ?? null
  }

  // Licensed translation not yet cached — caller should prewarm
  return null
}
