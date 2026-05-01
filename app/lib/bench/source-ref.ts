import type { BenchClippingSourceRef } from '@/lib/db/types'

/**
 * Parse the JSON-string `source_ref` column on a `BenchClipping` row.
 *
 * Returns null on malformed input (invalid JSON, non-object payload). Callers
 * decide what to do with null — usually rendering the clipping in a degraded
 * state. Centralizing the parse keeps `as` casts out of UI code and gives a
 * single place to layer in stricter discriminated-union validation later.
 */
export function parseSourceRef(json: string): BenchClippingSourceRef | null {
  if (!json) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  // The discriminator (`type` or `placeholder`) varies by variant; downstream
  // renderers narrow on it. We only guarantee here that the shape is an object.
  return parsed as BenchClippingSourceRef
}
