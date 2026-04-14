import type { ExploredEntity } from '../entity-layer-context';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  isCenter: boolean;
  entityType?: string;
  label: string;
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  label: string | null;
  /** Midpoint x for edge label placement */
  labelX: number;
  /** Midpoint y for edge label placement */
  labelY: number;
  /** Perpendicular offset angle (radians) for label offset */
  labelOffsetAngle: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  viewBox: { x: number; y: number; width: number; height: number };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_WEDGE = Math.PI / 8;
const MAX_WEDGE = 2 * Math.PI - MIN_WEDGE;
const RADIUS_STEP = 140;
const FIRST_RADIUS = 160;
const PADDING = 40;
const MIN_VIEWBOX = 600;

// ─── Helpers ────────────────────────────────────────────────────────────────

interface TreeNode {
  entity: ExploredEntity;
  children: TreeNode[];
}

function buildForest(explored: ExploredEntity[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const e of explored) {
    byId.set(e.entityId, { entity: e, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const e of explored) {
    const node = byId.get(e.entityId)!;
    if (e.openedFrom && byId.has(e.openedFrom)) {
      byId.get(e.openedFrom)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort children by firstOpenedAt for deterministic layout
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => a.entity.firstOpenedAt - b.entity.firstOpenedAt);
    node.children.forEach(sortChildren);
  };

  roots.sort((a, b) => a.entity.firstOpenedAt - b.entity.firstOpenedAt);
  roots.forEach(sortChildren);

  return roots;
}

function leafCount(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, c) => sum + leafCount(c), 0);
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function computeLayout(
  explored: ExploredEntity[],
  entityTypes: Map<string, string>,
  studyTitle: string
): GraphLayout {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Center node
  const centerId = '__center__';
  nodes.push({
    id: centerId,
    x: 0,
    y: 0,
    isCenter: true,
    label: studyTitle.length <= 18 ? studyTitle : 'This Study',
  });

  if (explored.length === 0) {
    return {
      nodes,
      edges,
      viewBox: {
        x: -MIN_VIEWBOX / 2,
        y: -MIN_VIEWBOX / 2,
        width: MIN_VIEWBOX,
        height: MIN_VIEWBOX,
      },
    };
  }

  const forest = buildForest(explored);
  const totalLeaves = forest.reduce((sum, r) => sum + leafCount(r), 0);

  // Assign angular wedges to roots, proportional to leaf count
  const rawWedges = forest.map(
    (r) => Math.max((leafCount(r) / totalLeaves) * 2 * Math.PI, MIN_WEDGE)
  );
  // Normalize so wedges sum to 2π, respecting maxWedge per root
  const rawSum = rawWedges.reduce((a, b) => a + b, 0);
  const scale = (2 * Math.PI) / rawSum;
  const wedges = rawWedges.map((w) => Math.min(w * scale, MAX_WEDGE));

  // Re-normalize after max clamping
  const clampedSum = wedges.reduce((a, b) => a + b, 0);
  const finalScale = (2 * Math.PI) / clampedSum;
  const finalWedges = wedges.map((w) => w * finalScale);

  let currentAngle = -Math.PI / 2; // start from top

  function placeSubtree(
    node: TreeNode,
    angleStart: number,
    angleEnd: number,
    depth: number,
    parentId: string
  ) {
    const angleMid = (angleStart + angleEnd) / 2;
    const radius = FIRST_RADIUS + (depth - 1) * RADIUS_STEP;
    const x = Math.cos(angleMid) * radius;
    const y = Math.sin(angleMid) * radius;

    nodes.push({
      id: node.entity.entityId,
      x,
      y,
      isCenter: false,
      entityType: entityTypes.get(node.entity.entityId),
      label: node.entity.entityId, // caller resolves to canonical_name
    });

    // Edge from parent
    const parentNode = nodes.find((n) => n.id === parentId)!;
    const midX = (parentNode.x + x) / 2;
    const midY = (parentNode.y + y) / 2;
    const edgeAngle = Math.atan2(y - parentNode.y, x - parentNode.x);
    const perpAngle = edgeAngle + Math.PI / 2;

    edges.push({
      fromId: parentId,
      toId: node.entity.entityId,
      label: node.entity.openedFromLabel,
      labelX: midX,
      labelY: midY,
      labelOffsetAngle: perpAngle,
    });

    // Recurse into children
    if (node.children.length > 0) {
      const parentWedge = angleEnd - angleStart;
      const childTotalLeaves = node.children.reduce((s, c) => s + leafCount(c), 0);

      // Compute raw wedges with MIN_WEDGE floor, then normalize to fit parent
      const rawChildWedges = node.children.map((child) => {
        const childLeaves = leafCount(child);
        return Math.max((parentWedge * childLeaves) / childTotalLeaves, MIN_WEDGE);
      });
      const rawChildSum = rawChildWedges.reduce((a, b) => a + b, 0);
      const childScale = rawChildSum > parentWedge ? parentWedge / rawChildSum : 1;

      let childAngleStart = angleStart;
      for (let ci = 0; ci < node.children.length; ci++) {
        const childWedge = rawChildWedges[ci] * childScale;
        placeSubtree(node.children[ci], childAngleStart, childAngleStart + childWedge, depth + 1, node.entity.entityId);
        childAngleStart += childWedge;
      }
    }
  }

  for (let i = 0; i < forest.length; i++) {
    const wedge = finalWedges[i];
    placeSubtree(forest[i], currentAngle, currentAngle + wedge, 1, centerId);
    currentAngle += wedge;
  }

  // Compute viewBox
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }

  const rawW = Math.max(maxX - minX + PADDING * 2, MIN_VIEWBOX);
  const rawH = Math.max(maxY - minY + PADDING * 2, MIN_VIEWBOX);
  // Use the larger dimension for both axes so a deep chain in one direction
  // still produces a wide viewBox (nodes are spread widely → viewBox grows).
  const contentW = Math.max(rawW, rawH);
  const contentH = contentW;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    nodes,
    edges,
    viewBox: {
      x: cx - contentW / 2,
      y: cy - contentH / 2,
      width: contentW,
      height: contentH,
    },
  };
}
