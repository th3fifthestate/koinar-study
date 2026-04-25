import { describe, it, expect } from 'vitest';
import {
  labelForSide,
  reciprocalFor,
  getSpec,
  RELATIONSHIP_REGISTRY,
  ALL_REGISTERED_TYPES,
} from './relationship-direction';

describe('relationship-direction', () => {
  describe('labelForSide', () => {
    // ── Asymmetric family types ─────────────────────────────────────────
    it('flips parent_of → "child of" on the to-side', () => {
      // Edge: Mary parent_of Matthew, label = "parent of".
      // Viewing Matthew's drawer (to-side): should read "child of".
      expect(labelForSide('parent_of', 'parent of', 'to')).toBe('child of');
    });

    it('keeps parent_of as "parent of" on the from-side', () => {
      // Viewing Mary's drawer (from-side): reads "parent of" (Mary is parent of Matthew).
      expect(labelForSide('parent_of', 'parent of', 'from')).toBe('parent of');
    });

    it('flips child_of → "parent of" on the to-side', () => {
      expect(labelForSide('child_of', 'child of', 'to')).toBe('parent of');
    });

    it('flips child_of with custom label → canonical "parent of" on the to-side', () => {
      // Even if the raw label has some variant phrasing, the canonical inverse wins.
      expect(labelForSide('child_of', 'son of', 'to')).toBe('parent of');
    });

    // ── Symmetric types ─────────────────────────────────────────────────
    it('keeps sibling_of label on both sides', () => {
      expect(labelForSide('sibling_of', 'sibling of', 'from')).toBe('sibling of');
      expect(labelForSide('sibling_of', 'sibling of', 'to')).toBe('sibling of');
    });

    it('keeps spouse_of label on both sides', () => {
      expect(labelForSide('spouse_of', 'spouse of', 'from')).toBe('spouse of');
      expect(labelForSide('spouse_of', 'spouse of', 'to')).toBe('spouse of');
    });

    it('keeps near label on both sides (symmetric)', () => {
      expect(labelForSide('near', 'near', 'to')).toBe('near');
    });

    // ── Asymmetric geographic/temporal ──────────────────────────────────
    it('flips located_in → "contains" on the to-side', () => {
      expect(labelForSide('located_in', 'located in', 'to')).toBe('contains');
    });

    it('flips contains → "located in" on the to-side', () => {
      expect(labelForSide('contains', 'contains', 'to')).toBe('located in');
    });

    it('flips preceded_by → "succeeded by" on the to-side', () => {
      expect(labelForSide('preceded_by', 'preceded by', 'to')).toBe('succeeded by');
    });

    it('flips oppressor_of ↔ opposed_by correctly', () => {
      expect(labelForSide('oppressor_of', 'enslaved', 'to')).toBe('opposed by');
      expect(labelForSide('opposed_by', 'opposed by', 'to')).toBe('oppressor of');
    });

    // ── No-inverse types ────────────────────────────────────────────────
    it('keeps label for no_inverse types (descended_from)', () => {
      // descended_from has no clean reciprocal in our schema — label stays raw.
      expect(labelForSide('descended_from', 'partially descended from', 'to'))
        .toBe('partially descended from');
    });

    // ── Unknown types ───────────────────────────────────────────────────
    it('keeps label for unregistered types (best-effort fallback)', () => {
      expect(labelForSide('something_new', 'custom label', 'to')).toBe('custom label');
    });
  });

  describe('reciprocalFor', () => {
    it('returns inverse for asymmetric types', () => {
      expect(reciprocalFor('parent_of', 'parent of')).toEqual({ type: 'child_of', label: 'child of' });
      expect(reciprocalFor('located_in', 'located in')).toEqual({ type: 'contains', label: 'contains' });
    });

    it('returns same type + original label for symmetric types', () => {
      expect(reciprocalFor('sibling_of', 'sibling of')).toEqual({ type: 'sibling_of', label: 'sibling of' });
      expect(reciprocalFor('associated_with', 'allied with')).toEqual({ type: 'associated_with', label: 'allied with' });
    });

    it('returns null for no_inverse types', () => {
      expect(reciprocalFor('descended_from', 'partially descended from')).toBeNull();
      expect(reciprocalFor('flows_into', 'flows into')).toBeNull();
      expect(reciprocalFor('during_period', 'occurs during')).toBeNull();
    });

    it('returns null for unregistered types', () => {
      expect(reciprocalFor('unknown_type', 'whatever')).toBeNull();
    });
  });

  describe('registry coverage', () => {
    it('every registered type resolves via getSpec', () => {
      for (const t of ALL_REGISTERED_TYPES) {
        expect(getSpec(t)).not.toBeNull();
      }
    });

    it('every asymmetric type has inverse_type and inverse_label populated', () => {
      for (const [type, spec] of Object.entries(RELATIONSHIP_REGISTRY)) {
        if (spec.kind === 'asymmetric') {
          expect(spec.inverse_type, `${type} missing inverse_type`).toBeTruthy();
          expect(spec.inverse_label, `${type} missing inverse_label`).toBeTruthy();
        }
      }
    });

    it('asymmetric inverses are mutually consistent (A→B means B→A points back to A)', () => {
      for (const [type, spec] of Object.entries(RELATIONSHIP_REGISTRY)) {
        if (spec.kind !== 'asymmetric' || !spec.inverse_type) continue;
        const counter = RELATIONSHIP_REGISTRY[spec.inverse_type];
        // The inverse must also be asymmetric, and its inverse must be the original type.
        expect(counter, `${type}'s inverse ${spec.inverse_type} not in registry`).toBeTruthy();
        if (counter && counter.kind === 'asymmetric') {
          // Not all asymmetric pairs are strictly mutual (subgroup_of is an example —
          // its inverse is `includes`, but `includes`'s inverse is `member_of`, not
          // `subgroup_of`). The registry comments document these intentional chains.
          const pairBack = counter.inverse_type;
          const mutual = pairBack === type;
          // If this fails for a new type, either the pair is mutual (fix) or it's an
          // intentional chain (document it in relationship-direction.ts).
          if (!mutual) {
            // Whitelist: intentional non-mutual chains.
            const intentionalChains = new Set(['subgroup_of']);
            expect(intentionalChains.has(type) || intentionalChains.has(spec.inverse_type),
              `${type} ↔ ${spec.inverse_type} non-mutual chain — add to whitelist if intentional`
            ).toBe(true);
          }
        }
      }
    });
  });
});
