import { describe, it, expect } from 'vitest';
import { computeLayout, type GraphLayout } from './layout';
import type { ExploredEntity } from '../entity-layer-context';

function makeExplored(
  id: string,
  openedFrom: string | null = null,
  label: string | null = null,
  time = Date.now()
): ExploredEntity {
  return { entityId: id, firstOpenedAt: time, openedFrom, openedFromLabel: label };
}

const TYPES = new Map([
  ['herod', 'person'],
  ['judea', 'place'],
  ['pilate', 'person'],
  ['jerusalem', 'place'],
]);

describe('computeLayout', () => {
  it('returns only the center node when explored is empty', () => {
    const result = computeLayout([], TYPES, 'Test Study');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].isCenter).toBe(true);
    expect(result.edges).toHaveLength(0);
  });

  it('returns N+1 nodes for N explored entities', () => {
    const explored = [
      makeExplored('herod', null, null, 1000),
      makeExplored('judea', 'herod', 'ruled', 2000),
    ];
    const result = computeLayout(explored, TYPES, 'Test Study');
    expect(result.nodes).toHaveLength(3); // center + herod + judea
    expect(result.edges).toHaveLength(2); // center→herod, herod→judea
  });

  it('produces deterministic output for the same input', () => {
    const explored = [
      makeExplored('herod', null, null, 1000),
      makeExplored('judea', 'herod', 'ruled', 2000),
      makeExplored('pilate', 'herod', 'predecessor', 3000),
      makeExplored('jerusalem', null, null, 4000),
    ];
    const a = computeLayout(explored, TYPES, 'Test Study');
    const b = computeLayout(explored, TYPES, 'Test Study');
    expect(a).toEqual(b);
  });

  it('center node is at (0, 0)', () => {
    const explored = [makeExplored('herod', null, null, 1000)];
    const result = computeLayout(explored, TYPES, 'Test Study');
    const center = result.nodes.find((n) => n.isCenter)!;
    expect(center.x).toBe(0);
    expect(center.y).toBe(0);
  });

  it('root entities are at FIRST_RADIUS distance from center', () => {
    const explored = [makeExplored('herod', null, null, 1000)];
    const result = computeLayout(explored, TYPES, 'Test Study');
    const herod = result.nodes.find((n) => n.id === 'herod')!;
    const dist = Math.sqrt(herod.x ** 2 + herod.y ** 2);
    expect(dist).toBeCloseTo(160, 0);
  });

  it('clamps viewBox to at least 600x600', () => {
    const explored = [makeExplored('herod', null, null, 1000)];
    const result = computeLayout(explored, TYPES, 'Test Study');
    expect(result.viewBox.width).toBeGreaterThanOrEqual(600);
    expect(result.viewBox.height).toBeGreaterThanOrEqual(600);
  });

  it('viewBox grows beyond 600x600 when nodes are spread widely', () => {
    const explored = [
      makeExplored('a', null, null, 1000),
      makeExplored('b', 'a', 'r1', 2000),
      makeExplored('c', 'b', 'r2', 3000),
      makeExplored('d', 'c', 'r3', 4000),
    ];
    const types = new Map([['a', 'person'], ['b', 'person'], ['c', 'person'], ['d', 'person']]);
    const result = computeLayout(explored, types, 'Test Study');
    expect(result.viewBox.width).toBeGreaterThan(600);
  });

  it('edge labels carry the openedFromLabel', () => {
    const explored = [
      makeExplored('herod', null, null, 1000),
      makeExplored('judea', 'herod', 'ruled', 2000),
    ];
    const result = computeLayout(explored, TYPES, 'Test Study');
    const rootEdge = result.edges.find((e) => e.toId === 'herod')!;
    expect(rootEdge.label).toBeNull();
    const childEdge = result.edges.find((e) => e.toId === 'judea')!;
    expect(childEdge.label).toBe('ruled');
  });

  it('handles multi-root forest correctly', () => {
    const explored = [
      makeExplored('herod', null, null, 1000),
      makeExplored('jerusalem', null, null, 2000),
      makeExplored('pilate', null, null, 3000),
    ];
    const result = computeLayout(explored, TYPES, 'Test Study');
    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);
    const roots = result.nodes.filter((n) => !n.isCenter);
    const distances = roots.map((n) => Math.sqrt(n.x ** 2 + n.y ** 2));
    distances.forEach((d) => expect(d).toBeCloseTo(160, 0));
  });
});
