const TAB_COPY: Record<string, string> = {
  verses: 'Search a reference, like "John 3:16" or "Gen 1".',
  entities: 'Search a name — Ruth, Paul, Pilate.',
  lexicon: "Search a Greek or Hebrew word. Or a Strong's number.",
  'cross-refs': "Enter a reference. You'll get the refs that fan from it.",
  notes: 'Your notes from reading land here. Search a phrase, a word, a book.',
  studies: 'Your own studies are here too. Search a title or a theme.',
}

interface SourceDrawerEmptyStateProps {
  tabId: string
}

export function SourceDrawerEmptyState({ tabId }: SourceDrawerEmptyStateProps) {
  const copy = TAB_COPY[tabId] ?? 'Nothing here yet.'
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <p className="text-sm font-medium text-foreground">{copy}</p>
    </div>
  )
}
