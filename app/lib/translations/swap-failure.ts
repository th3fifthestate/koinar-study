// app/lib/translations/swap-failure.ts
//
// Pure type + constant module for swap failure reasons. Extracted from
// swap-engine.ts so Client Components can import the hint map and the
// discriminated-union type without pulling in the server-only swap pipeline
// (better-sqlite3, fums-tracker, api-bible-client, etc.).
//
// Keep this file free of server-only imports.

export type SwapFailureReason = 'network' | 'rate-limit' | 'licensing' | 'offline';

export const SWAP_FAILURE_HINT: Record<SwapFailureReason, string> = {
  'network': 'Translation source unreachable',
  'rate-limit': 'Quota reached — try again later',
  'licensing': 'Unavailable for this study',
  'offline': "You're offline",
};
