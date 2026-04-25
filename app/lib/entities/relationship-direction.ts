/**
 * Relationship direction & inverse registry.
 *
 * Single source of truth for (a) how a relationship should be labelled when
 * viewed from the `to_entity_id` side of an edge, and (b) which types need a
 * reciprocal row inserted for graph-walking correctness.
 *
 * Used by:
 *   - lib/db/entities/queries.ts   →  computes `displayed_label` per edge
 *                                      so the drawer reads correctly on both
 *                                      sides.
 *   - scripts/validate-entity-relationships.ts  →  detects missing reciprocals
 *                                      and optionally inserts them.
 *
 * See /founders-files/reports/relationship-mismatch-report.json for a snapshot
 * of every asymmetric edge currently in the DB.
 */

// ── Kinds ──────────────────────────────────────────────────────────────────
//
// 'symmetric'  : A→B implies B→A with the SAME type + label.  Drawer label
//                stays the same regardless of which side the current entity
//                is on (e.g. "sibling of", "spouse of", "near", "same as").
//
// 'asymmetric' : A→B implies B→A with a DIFFERENT type + inverse label
//                (e.g. parent_of ↔ child_of, located_in ↔ contains).  The
//                drawer must flip the label when rendering from the `to` side.
//
// 'no_inverse' : One-way edge with no well-defined reciprocal in our schema.
//                Rendered with the raw label on both sides (best-effort).
//                Currently: `descended_from` (1 edge), `flows_into` (1 edge),
//                `during_period` (1 edge).  These are ignored by the validator
//                and by the reciprocal backfill.

export type RelationshipKind = 'symmetric' | 'asymmetric' | 'no_inverse';

export interface RelationshipSpec {
  kind: RelationshipKind;
  /** For 'asymmetric' only: the paired type on the reciprocal side. */
  inverse_type?: string;
  /** For 'asymmetric' only: the canonical label on the reciprocal side. */
  inverse_label?: string;
}

/**
 * Inverse registry. Keys are `relationship_type` values seen in the DB
 * (run `SELECT DISTINCT relationship_type FROM entity_relationships`).
 *
 * When you add a new type, append it here first — the validator will error on
 * unknown types, forcing us to make a conscious direction decision rather than
 * silently shipping an asymmetric edge.
 */
export const RELATIONSHIP_REGISTRY: Record<string, RelationshipSpec> = {
  // ── Family (asymmetric) ───────────────────────────────────────────
  parent_of: { kind: 'asymmetric', inverse_type: 'child_of',  inverse_label: 'child of'  },
  child_of:  { kind: 'asymmetric', inverse_type: 'parent_of', inverse_label: 'parent of' },

  // ── Family (symmetric) ────────────────────────────────────────────
  spouse_of:  { kind: 'symmetric' },
  sibling_of: { kind: 'symmetric' },

  // ── Geographic (asymmetric) ───────────────────────────────────────
  located_in: { kind: 'asymmetric', inverse_type: 'contains', inverse_label: 'contains' },
  contains:   { kind: 'asymmetric', inverse_type: 'located_in', inverse_label: 'located in' },

  // ── Groups (asymmetric) ───────────────────────────────────────────
  member_of:    { kind: 'asymmetric', inverse_type: 'includes',  inverse_label: 'includes'  },
  includes:     { kind: 'asymmetric', inverse_type: 'member_of', inverse_label: 'member of' },
  subgroup_of:  { kind: 'asymmetric', inverse_type: 'includes',  inverse_label: 'includes subgroup' },

  // ── Temporal (asymmetric) ─────────────────────────────────────────
  preceded_by:     { kind: 'asymmetric', inverse_type: 'succeeded_by',    inverse_label: 'succeeded by' },
  succeeded_by:    { kind: 'asymmetric', inverse_type: 'preceded_by',     inverse_label: 'preceded by'  },
  successor_of:    { kind: 'asymmetric', inverse_type: 'predecessor_of',  inverse_label: 'predecessor of' },
  predecessor_of:  { kind: 'asymmetric', inverse_type: 'successor_of',    inverse_label: 'successor of'   },

  // ── Conflict (asymmetric) ─────────────────────────────────────────
  oppressor_of: { kind: 'asymmetric', inverse_type: 'opposed_by',  inverse_label: 'opposed by'  },
  opposed_by:   { kind: 'asymmetric', inverse_type: 'oppressor_of', inverse_label: 'oppressor of' },

  // ── Geographic (symmetric) ────────────────────────────────────────
  near:       { kind: 'symmetric' },
  adjacent_to: { kind: 'symmetric' },

  // ── Generic (symmetric) ───────────────────────────────────────────
  same_as:         { kind: 'symmetric' },
  rival_of:        { kind: 'symmetric' },
  contemporary_of: { kind: 'symmetric' },
  associated_with: { kind: 'symmetric' },
  related_to:      { kind: 'symmetric' },

  // ── No defined inverse (one-off data) ─────────────────────────────
  descended_from: { kind: 'no_inverse' },
  flows_into:     { kind: 'no_inverse' },
  during_period:  { kind: 'no_inverse' },
};

/**
 * Return the spec for a given type, or null if the type is not registered.
 * A null result means the caller should treat the type as no_inverse — i.e.
 * do not flip the label, do not backfill.
 */
export function getSpec(type: string): RelationshipSpec | null {
  return RELATIONSHIP_REGISTRY[type] ?? null;
}

/**
 * Compute the label to display when the CURRENT entity is at `side` of the
 * edge (`from` or `to`).
 *
 * - `from` side always uses the edge's own `relationship_label` (the raw label
 *   captures nuance from the source import better than a generic canonical).
 * - `to` side flips for asymmetric types, stays the same for symmetric /
 *   no_inverse types.
 */
export function labelForSide(
  type: string,
  rawLabel: string,
  side: 'from' | 'to'
): string {
  if (side === 'from') return rawLabel;
  const spec = getSpec(type);
  if (!spec) return rawLabel;
  if (spec.kind === 'asymmetric' && spec.inverse_label) return spec.inverse_label;
  return rawLabel;
}

/**
 * Return the reciprocal (type, label) we should insert to make an edge
 * symmetric in the DB, or null if none applies.
 * - asymmetric: returns the inverse type + canonical inverse label.
 * - symmetric: returns the same type + the original label (so B→A is inserted).
 * - no_inverse: returns null — skip.
 */
export function reciprocalFor(
  type: string,
  originalLabel: string
): { type: string; label: string } | null {
  const spec = getSpec(type);
  if (!spec) return null;
  if (spec.kind === 'asymmetric' && spec.inverse_type && spec.inverse_label) {
    return { type: spec.inverse_type, label: spec.inverse_label };
  }
  if (spec.kind === 'symmetric') {
    return { type, label: originalLabel };
  }
  return null;
}

/**
 * List of all registered types. Useful for validator coverage checks.
 */
export const ALL_REGISTERED_TYPES = Object.keys(RELATIONSHIP_REGISTRY);
