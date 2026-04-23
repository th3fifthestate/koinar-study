export interface Quote {
  body: string;
  attribution: string;
}

const QUOTES: Quote[] = [
  { body: 'To every thing there is a season, and a time to every purpose under the heaven.', attribution: '— Ecclesiastes 3:1, KJV' },
  { body: 'Be still, and know that I am God.', attribution: '— Psalm 46:10, BSB' },
  { body: 'The grass withereth, the flower fadeth: but the word of our God shall stand for ever.', attribution: '— Isaiah 40:8, KJV' },
  { body: 'The LORD is my shepherd; I shall not want.', attribution: '— Psalm 23:1, KJV' },
  { body: 'Weeping may endure for a night, but joy cometh in the morning.', attribution: '— Psalm 30:5, KJV' },
  { body: 'In the beginning was the Word, and the Word was with God, and the Word was God.', attribution: '— John 1:1, BSB' },
  { body: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', attribution: '— Matthew 11:28, KJV' },
  { body: 'Finally, brothers, whatever is true, whatever is honorable, whatever is right, whatever is pure, whatever is lovely, whatever is admirable — if anything is excellent or praiseworthy — think on these things.', attribution: '— Philippians 4:8, BSB' },
];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export function getQuoteForToday(now: Date = new Date()): Quote {
  return QUOTES[dayOfYear(now) % QUOTES.length];
}
