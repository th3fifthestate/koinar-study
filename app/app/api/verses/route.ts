import { NextRequest, NextResponse } from 'next/server';
import { getVerse, getVerseRange, normalizeBookName } from '@/lib/db/bible/queries';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

const isRateLimited = createRateLimiter({ windowMs: 60_000, max: 60 });

// Parse a reference like "John 3:16" or "1 Corinthians 2:1-5"
function parseReference(ref: string): {
  book: string;
  chapter: number;
  startVerse: number;
  endVerse?: number;
} | null {
  const match = ref.match(
    /^(\d?\s?[A-Za-z]+(?:\s[A-Za-z]+)*)\s+(\d+):(\d+)(?:-(\d+))?$/
  );
  if (!match) return null;

  const book = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const startVerse = parseInt(match[3], 10);
  const endVerse = match[4] ? parseInt(match[4], 10) : undefined;

  if (isNaN(chapter) || isNaN(startVerse)) return null;

  return { book, chapter, startVerse, endVerse };
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  const ref = request.nextUrl.searchParams.get('ref');
  if (!ref || typeof ref !== 'string') {
    return NextResponse.json(
      { error: 'Missing ref parameter' },
      { status: 400 }
    );
  }

  const parsed = parseReference(ref.trim());
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid reference format. Expected: "Book Chapter:Verse" or "Book Chapter:Start-End"' },
      { status: 400 }
    );
  }

  const bookName = normalizeBookName(parsed.book);
  if (!bookName) {
    return NextResponse.json(
      { error: 'Unknown book name' },
      { status: 404 }
    );
  }

  let text: string;
  let formattedRef: string;

  if (parsed.endVerse && parsed.endVerse > parsed.startVerse) {
    const verses = getVerseRange(parsed.book, parsed.chapter, parsed.startVerse, parsed.endVerse);
    if (verses.length === 0) {
      return NextResponse.json(
        { error: 'Verses not found' },
        { status: 404 }
      );
    }
    text = verses.map((v) => v.text.trim()).join(' ');
    formattedRef = `${bookName} ${parsed.chapter}:${parsed.startVerse}-${parsed.endVerse}`;
  } else {
    const verse = getVerse(parsed.book, parsed.chapter, parsed.startVerse);
    if (!verse) {
      return NextResponse.json(
        { error: 'Verse not found' },
        { status: 404 }
      );
    }
    text = verse.text.trim();
    formattedRef = `${bookName} ${parsed.chapter}:${parsed.startVerse}`;
  }

  return NextResponse.json({
    reference: formattedRef,
    text,
    translation: 'BSB',
  });
}
