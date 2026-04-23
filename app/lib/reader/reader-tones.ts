import type { TodBucket } from '@/lib/home/tod-bucket';

/**
 * Paper and ink palette for the reader surface.
 *
 * Light mode: TOD-tinted cream → amber → parchment.
 * Dark mode: warm-black walnut with varied accent zones (sage / warmth /
 * cream) so sections don't all read as layered browns — Ritz-Carlton
 * interior palette logic, not a monochrome sepia wash.
 */
export interface ReaderPalette {
  paper: string;        // base surface
  paperDeep: string;    // inset surface (article card, TOC pane)
  ink: string;          // body text
  inkSoft: string;      // secondary text, meta
  display: string;      // heading ink (slightly lifted)
  rule: string;         // hairline rules, section borders
  accentWarmth: string; // amber / tobacco — pullquote rules, entity marks
  accentSage: string;   // muted green — section ornaments, accents
  entityUnderline: string;
  washWarmth: string;   // large tonal wash (rgba form)
  washSage: string;     // large tonal wash (rgba form)
}

export const READER_PALETTE_LIGHT: Record<TodBucket, ReaderPalette> = {
  dawn: {
    paper: '#f6f2e8',
    paperDeep: '#f0ead9',
    ink: '#2c2924',
    inkSoft: '#5c564a',
    display: '#2c2924',
    rule: '#d8d0bd',
    accentWarmth: '#c49a6c',
    accentSage: '#8fa685',
    entityUnderline: '#c49a6c',
    washWarmth: 'rgba(196,154,108,0.12)',
    washSage: 'rgba(143,166,133,0.10)',
  },
  morning: {
    paper: '#f7f4ec',
    paperDeep: '#f0ebdd',
    ink: '#2c2924',
    inkSoft: '#5c564a',
    display: '#2c2924',
    rule: '#d8d0bd',
    accentWarmth: '#c49a6c',
    accentSage: '#8fa685',
    entityUnderline: '#c49a6c',
    washWarmth: 'rgba(196,154,108,0.10)',
    washSage: 'rgba(143,166,133,0.09)',
  },
  midday: {
    paper: '#f5f1e6',
    paperDeep: '#ede6d4',
    ink: '#2c2924',
    inkSoft: '#5c564a',
    display: '#2c2924',
    rule: '#d5ccb8',
    accentWarmth: '#c49a6c',
    accentSage: '#8fa685',
    entityUnderline: '#c49a6c',
    washWarmth: 'rgba(196,154,108,0.10)',
    washSage: 'rgba(143,166,133,0.08)',
  },
  golden: {
    paper: '#f5ecd9',
    paperDeep: '#ecddc0',
    ink: '#302a22',
    inkSoft: '#5c564a',
    display: '#2c2924',
    rule: '#d8c9a8',
    accentWarmth: '#b88854',
    accentSage: '#7e9875',
    entityUnderline: '#b88854',
    washWarmth: 'rgba(184,136,84,0.14)',
    washSage: 'rgba(126,152,117,0.08)',
  },
  evening: {
    paper: '#f2e7d1',
    paperDeep: '#ead8b3',
    ink: '#2e2820',
    inkSoft: '#5c564a',
    display: '#2c2924',
    rule: '#d4c29d',
    accentWarmth: '#a8744a',
    accentSage: '#738b6b',
    entityUnderline: '#a8744a',
    washWarmth: 'rgba(168,116,74,0.15)',
    washSage: 'rgba(115,139,107,0.08)',
  },
  night: {
    paper: '#ede2cb',
    paperDeep: '#e2d2ae',
    ink: '#2b251c',
    inkSoft: '#5c564a',
    display: '#2c2924',
    rule: '#cdb895',
    accentWarmth: '#8f5f3c',
    accentSage: '#617a5a',
    entityUnderline: '#8f5f3c',
    washWarmth: 'rgba(143,95,60,0.14)',
    washSage: 'rgba(97,122,90,0.10)',
  },
};

export const READER_PALETTE_DARK: Record<TodBucket, ReaderPalette> = {
  dawn: {
    paper: '#161410',
    paperDeep: '#272019',
    ink: '#d6cfbf',
    inkSoft: '#9a9184',
    display: '#e8dcc4',
    rule: '#3e3529',
    accentWarmth: '#c49a6c',
    accentSage: '#8faa85',
    entityUnderline: '#c49a6c',
    washWarmth: 'rgba(196,154,108,0.18)',
    washSage: 'rgba(143,170,133,0.14)',
  },
  morning: {
    paper: '#17140f',
    paperDeep: '#28221b',
    ink: '#d6cfbf',
    inkSoft: '#9a9184',
    display: '#e8dcc4',
    rule: '#40362a',
    accentWarmth: '#c49a6c',
    accentSage: '#8faa85',
    entityUnderline: '#c49a6c',
    washWarmth: 'rgba(196,154,108,0.16)',
    washSage: 'rgba(143,170,133,0.13)',
  },
  midday: {
    paper: '#15140f',
    paperDeep: '#26221a',
    ink: '#d6cfbf',
    inkSoft: '#9a9184',
    display: '#e8dcc4',
    rule: '#3c3429',
    accentWarmth: '#c49a6c',
    accentSage: '#8faa85',
    entityUnderline: '#c49a6c',
    washWarmth: 'rgba(196,154,108,0.14)',
    washSage: 'rgba(143,170,133,0.12)',
  },
  golden: {
    paper: '#1a1510',
    paperDeep: '#2c241a',
    ink: '#dccfb4',
    inkSoft: '#a89b85',
    display: '#ebd9b4',
    rule: '#463a2c',
    accentWarmth: '#d4a878',
    accentSage: '#8faa85',
    entityUnderline: '#d4a878',
    washWarmth: 'rgba(212,168,120,0.22)',
    washSage: 'rgba(143,170,133,0.14)',
  },
  evening: {
    paper: '#181410',
    paperDeep: '#2a221a',
    ink: '#d6c8b0',
    inkSoft: '#a0927f',
    display: '#e8d4a8',
    rule: '#463828',
    accentWarmth: '#d4a878',
    accentSage: '#8faa85',
    entityUnderline: '#d4a878',
    washWarmth: 'rgba(212,168,120,0.22)',
    washSage: 'rgba(143,170,133,0.16)',
  },
  night: {
    paper: '#11100c',
    paperDeep: '#1f1c15',
    ink: '#c8c0b0',
    inkSoft: '#8a8375',
    display: '#d9c99e',
    rule: '#352e24',
    accentWarmth: '#b88854',
    accentSage: '#7c9b78',
    entityUnderline: '#b88854',
    washWarmth: 'rgba(184,136,84,0.20)',
    washSage: 'rgba(124,155,120,0.14)',
  },
};

export function getReaderPalette(bucket: TodBucket, mode: 'dark' | 'light' | 'sepia'): ReaderPalette {
  if (mode === 'dark') return READER_PALETTE_DARK[bucket];
  if (mode === 'light') return READER_PALETTE_LIGHT[bucket];
  // 'sepia': 28c will add READER_PALETTE_SEPIA; fall through to dark for now
  return READER_PALETTE_DARK[bucket];
}
