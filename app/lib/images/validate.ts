/**
 * Magic-byte validation for image uploads. Defense in depth ahead of `sharp`
 * — even though sharp itself rejects non-image input, libvips has had multiple
 * CVEs over the years and the cheapest mitigation is to never let unvalidated
 * bytes reach the parser. Returns true if the buffer's leading bytes match
 * one of our supported image formats.
 */

const SIGNATURES: ReadonlyArray<{ name: string; bytes: ReadonlyArray<number | null> }> = [
  // JPEG: FF D8 FF
  { name: 'jpeg', bytes: [0xff, 0xd8, 0xff] },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { name: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WebP: RIFF????WEBP — bytes 0-3 = "RIFF", bytes 8-11 = "WEBP"
  { name: 'webp', bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50] },
  // GIF87a / GIF89a: 47 49 46 38 (37|39) 61
  { name: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
];

export function isValidImageMagic(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  for (const sig of SIGNATURES) {
    if (buffer.length < sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      const expected = sig.bytes[i];
      if (expected === null) continue; // wildcard byte (RIFF length field)
      if (buffer[i] !== expected) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

/**
 * Decoded byte ceiling for accepted image uploads. ~25 MB covers any
 * legitimate hi-res photo we'd attach to a study; rejecting larger inputs
 * caps memory amplification on the route handler ahead of sharp parsing.
 */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/**
 * Base64-encoded byte ceiling for the JSON body field. Roughly 4/3 of the
 * decoded byte ceiling, plus a small slack for padding/whitespace. Enforced
 * by Zod before the buffer is even allocated so a 200 MB payload never
 * reaches Buffer.from().
 */
export const MAX_IMAGE_BASE64_CHARS = 35_000_000;
