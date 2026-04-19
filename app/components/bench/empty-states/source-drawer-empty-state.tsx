const TAB_COPY: Record<string, { heading: string; body: string }> = {
  verses:       { heading: 'Search for a verse',
                  body: 'Enter a book, chapter, or keyword to find Scripture passages.' },
  entities:     { heading: 'Search for a person or place',
                  body: 'Type a name to find biblical characters, locations, and events.' },
  lexicon:      { heading: 'Look up a word',
                  body: "Enter a Strong's number or English word to explore the original language." },
  'cross-refs': { heading: 'Explore connections',
                  body: 'Search a verse to see related passages across the canon.' },
  notes:        { heading: 'No notes yet',
                  body: 'Highlight text in a study to create notes you can pin here.' },
  studies:      { heading: 'Search studies',
                  body: 'Find published studies by topic, title, or keyword.' },
}

interface SourceDrawerEmptyStateProps {
  tabId: string
}

export function SourceDrawerEmptyState({ tabId }: SourceDrawerEmptyStateProps) {
  const copy = TAB_COPY[tabId] ?? { heading: 'Nothing here yet', body: 'Try a search above.' }
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <p className="text-sm font-medium text-foreground">{copy.heading}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{copy.body}</p>
    </div>
  )
}
