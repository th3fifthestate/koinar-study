import { describe, it, expect } from 'vitest';
import { extractDisambiguator } from './backfill-person-disambiguation';

describe('extractDisambiguator', () => {
  describe('clean extractions', () => {
    it('extracts "Antipas" from "Herod Antipas was the tetrarch of Galilee…"', () => {
      expect(
        extractDisambiguator(
          'Herod',
          'Herod Antipas was the tetrarch of Galilee and Perea during Jesus\' ministry.'
        )
      ).toBe('Antipas');
    });

    it('extracts "the Great" from "Herod the Great is introduced…"', () => {
      expect(
        extractDisambiguator(
          'Herod',
          "Herod the Great is introduced in the New Testament as 'King Herod' ruling Judea."
        )
      ).toBe('the Great');
    });

    it('extracts "the Tetrarch" from "Philip the Tetrarch, son of Herod…"', () => {
      expect(
        extractDisambiguator(
          'Philip',
          'Philip the Tetrarch, son of Herod the Great by Cleopatra of Jerusalem, ruled over Ituraea.'
        )
      ).toBe('the Tetrarch');
    });

    it('extracts "the Baptist" from "John the Baptist was miraculously born…"', () => {
      expect(
        extractDisambiguator(
          'John',
          'John the Baptist was miraculously born to the elderly priest Zechariah.'
        )
      ).toBe('the Baptist');
    });

    it('extracts "son of Alphaeus" from "James son of Alphaeus was…"', () => {
      expect(
        extractDisambiguator(
          'James',
          'James son of Alphaeus was one of the twelve apostles chosen by Jesus.'
        )
      ).toBe('son of Alphaeus');
    });

    it('extracts "the mother of John Mark" from comma-form summary', () => {
      expect(
        extractDisambiguator(
          'Mary',
          'Mary, the mother of John Mark, is identified in Acts 12:12 as a Jerusalem Christian.'
        )
      ).toBe('the mother of John Mark');
    });

    it('extracts "the wife of Clopas" from comma-form summary', () => {
      expect(
        extractDisambiguator(
          'Mary',
          'Mary, the wife of Clopas, was one of the faithful women.'
        )
      ).toBe('the wife of Clopas');
    });

    it('extracts "of Bethany" from "Mary of Bethany appears…"', () => {
      expect(
        extractDisambiguator(
          'Mary',
          'Mary of Bethany appears in three significant episodes in the Gospels.'
        )
      ).toBe('of Bethany');
    });

    it('strips a leading parenthetical "(Greek: …)" before extraction', () => {
      expect(
        extractDisambiguator(
          'Joseph',
          'Joseph (Greek: Ἰωσήφ) of Arimathea was a wealthy member of the Sanhedrin.'
        )
      ).toBe('of Arimathea');
    });

    it('strips inline "(Greek: …)" parentheticals from the candidate', () => {
      // Pattern: "Judas surnamed Barsabbas (Greek: …) was a prophet…"
      expect(
        extractDisambiguator(
          'Judas',
          'Judas surnamed Barsabbas (Greek: Ἰούδας Βαρσαβᾶς) was a prophet and leader.'
        )
      ).toBe('surnamed Barsabbas');
    });
  });

  describe('safety: skips when no good disambiguator exists', () => {
    it('returns null when summary does not start with the canonical name', () => {
      // Pattern: "In his letter to the Romans, Paul greets Mary…" — strict mode skip.
      expect(
        extractDisambiguator(
          'Mary',
          'In his letter to the Romans, Paul includes a personal greeting to Mary.'
        )
      ).toBeNull();
    });

    it('returns null when canonical name is followed immediately by a verb (no epithet)', () => {
      // "Joseph was a descendant…" — no disambiguator between name and verb.
      expect(
        extractDisambiguator(
          'Joseph',
          'Joseph was a descendant of King David who lived in Nazareth.'
        )
      ).toBeNull();
    });

    it('returns null when canonical name is followed by "appears" (no epithet)', () => {
      expect(
        extractDisambiguator(
          'Joseph',
          'Joseph appears solely in Luke\'s genealogy of Jesus Christ.'
        )
      ).toBeNull();
    });

    it('returns null on null/empty summary', () => {
      expect(extractDisambiguator('Anything', null)).toBeNull();
      expect(extractDisambiguator('Anything', '')).toBeNull();
      expect(extractDisambiguator('Anything', '   ')).toBeNull();
    });

    it('returns null when extracted candidate exceeds 60 chars', () => {
      // Very long epithet without a verb cut → too long, skip.
      const longSummary =
        'Joseph the firstborn son of Jacob and Rachel and the founder of two of the twelve tribes of Israel was beloved.';
      expect(extractDisambiguator('Joseph', longSummary)?.length ?? 0).toBeLessThanOrEqual(60);
    });

  });

  describe('OT son-of-X patterns', () => {
    it('extracts "son of Isshiah" from typical OT priestly summary', () => {
      expect(
        extractDisambiguator(
          'Zechariah',
          'Zechariah son of Isshiah was one of the Levites assigned to gatekeeper duty.'
        )
      ).toBe('son of Isshiah');
    });

    it('extracts "the Nehelamite" geographic epithet', () => {
      expect(
        extractDisambiguator(
          'Shemaiah',
          'Shemaiah the Nehelamite was a false prophet during the Babylonian exile.'
        )
      ).toBe('the Nehelamite');
    });
  });
});
