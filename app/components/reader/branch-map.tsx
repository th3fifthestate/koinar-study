'use client';

import { useMemo, useCallback } from 'react';
import { useEntityLayer, type ExploredEntity } from './entity-layer-context';
import { computeLayout, type GraphNode } from './branch-map/layout';
import { truncateLabel } from './branch-map/truncate';

// ─── Entity type color dots (reuses entity-term palette) ────────────────────

const TYPE_DOT_COLORS: Record<string, string> = {
  person: 'var(--sage-500)',
  place: 'var(--warmth)',
  culture: 'var(--sage-700)',
  time_period: 'var(--stone-500)',
  concept: 'var(--sage-300)',
  custom: 'var(--stone-300)',
};

// ─── Constants ──────────────────────────────────────────────────────────────

const NODE_RADIUS = 22;
const CENTER_RADIUS = 28;
const DOT_RADIUS = 4;
const LABEL_OFFSET_Y = 6; // perpendicular offset for edge labels in px

// ─── Component ──────────────────────────────────────────────────────────────

interface BranchMapProps {
  studyTitle: string;
  onNodeClick: (entityId: string) => void;
}

export function BranchMap({ studyTitle, onNodeClick }: BranchMapProps) {
  const { exploredEntities, entityMap } = useEntityLayer();

  const entityTypes = useMemo(
    () => new Map(Array.from(entityMap.entries()).map(([id, e]) => [id, e.entity_type])),
    [entityMap]
  );

  const entityNames = useMemo(
    () => new Map(Array.from(entityMap.entries()).map(([id, e]) => [id, e.canonical_name])),
    [entityMap]
  );

  const layout = useMemo(
    () => computeLayout(exploredEntities, entityTypes, studyTitle),
    [exploredEntities, entityTypes, studyTitle]
  );

  const { nodes, edges, viewBox } = layout;

  const resolveLabel = useCallback(
    (node: GraphNode) => {
      if (node.isCenter) return node.label;
      return entityNames.get(node.id) ?? node.id;
    },
    [entityNames]
  );

  // ── Build a11y tree structure ──
  const a11yTree = useMemo(() => {
    type A11yNode = {
      id: string;
      name: string;
      isCenter: boolean;
      openedFromLabel: string | null;
      children: A11yNode[];
      orderLabel: string;
    };

    const explored = exploredEntities;
    const byId = new Map<string, A11yNode>();

    // Center node
    const center: A11yNode = {
      id: '__center__',
      name: studyTitle,
      isCenter: true,
      openedFromLabel: null,
      children: [],
      orderLabel: '',
    };
    byId.set('__center__', center);

    for (let i = 0; i < explored.length; i++) {
      const e = explored[i];
      byId.set(e.entityId, {
        id: e.entityId,
        name: entityNames.get(e.entityId) ?? e.entityId,
        isCenter: false,
        openedFromLabel: e.openedFromLabel,
        children: [],
        orderLabel: `explored ${ordinal(i + 1)}`,
      });
    }

    for (const e of explored) {
      const parentId = e.openedFrom && byId.has(e.openedFrom) ? e.openedFrom : '__center__';
      byId.get(parentId)!.children.push(byId.get(e.entityId)!);
    }

    return center;
  }, [exploredEntities, entityNames, studyTitle]);

  return (
    <div role="region" aria-label={`Branch map with ${exploredEntities.length} ${exploredEntities.length === 1 ? 'entity' : 'entities'} explored from this study`}>
      {/* ── SVG Graph ── */}
      <svg
        aria-hidden="true"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        {/* Edges */}
        {edges.map((edge) => {
          const from = nodes.find((n) => n.id === edge.fromId)!;
          const to = nodes.find((n) => n.id === edge.toId)!;
          return (
            <g key={`${edge.fromId}-${edge.toId}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className="stroke-[var(--stone-300)] dark:stroke-[var(--stone-700)]"
                strokeWidth={1.5}
              />
              {edge.label && (
                <text
                  x={edge.labelX + Math.cos(edge.labelOffsetAngle) * LABEL_OFFSET_Y}
                  y={edge.labelY + Math.sin(edge.labelOffsetAngle) * LABEL_OFFSET_Y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-[var(--stone-400)] font-sans text-[10px] tracking-wide dark:fill-[var(--stone-500)]"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const label = resolveLabel(node);
          const displayLabel = node.isCenter ? label : truncateLabel(label);
          const r = node.isCenter ? CENTER_RADIUS : NODE_RADIUS;
          const dotColor = !node.isCenter ? TYPE_DOT_COLORS[node.entityType ?? 'custom'] ?? TYPE_DOT_COLORS.custom : undefined;

          return (
            <g
              key={node.id}
              className={node.isCenter ? '' : 'cursor-pointer'}
              onClick={() => !node.isCenter && onNodeClick(node.id)}
            >
              {/* Node circle */}
              {node.isCenter ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  className="fill-[var(--stone-800)] dark:fill-[var(--stone-200)]"
                />
              ) : (
                <>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    className="fill-[var(--stone-50)] stroke-[var(--stone-300)] dark:fill-[var(--stone-900)] dark:stroke-[var(--stone-700)]"
                    strokeWidth={1.5}
                  />
                  {/* Entity type color dot */}
                  <circle
                    cx={node.x}
                    cy={node.y - r + DOT_RADIUS + 4}
                    r={DOT_RADIUS}
                    fill={dotColor}
                  />
                </>
              )}

              {/* Label */}
              <text
                x={node.x}
                y={node.y + r + 14}
                textAnchor="middle"
                dominantBaseline="hanging"
                className={
                  node.isCenter
                    ? 'fill-[var(--stone-800)] font-display text-xs dark:fill-[var(--stone-200)]'
                    : 'fill-[var(--stone-700)] font-display text-xs dark:fill-[var(--stone-300)]'
                }
              >
                {displayLabel}
              </text>

              {/* Native SVG tooltip for full name */}
              {!node.isCenter && displayLabel !== label && (
                <title>{label}</title>
              )}
            </g>
          );
        })}
      </svg>

      {/* ── Accessible parallel list ── */}
      <A11yList node={a11yTree} onOpen={onNodeClick} />
    </div>
  );
}

// ─── A11y List ──────────────────────────────────────────────────────────────

interface A11yNode {
  id: string;
  name: string;
  isCenter: boolean;
  openedFromLabel: string | null;
  children: A11yNode[];
  orderLabel: string;
}

function A11yList({ node, onOpen }: { node: A11yNode; onOpen: (id: string) => void }) {
  return (
    <ul className="sr-only">
      <li>
        {node.name}
        {node.children.length > 0 && (
          <ul>
            {node.children.map((child) => (
              <A11yListItem key={child.id} node={child} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </li>
    </ul>
  );
}

function A11yListItem({ node, onOpen }: { node: A11yNode; onOpen: (id: string) => void }) {
  return (
    <li>
      {node.name}
      {node.openedFromLabel && ` — related as: ${node.openedFromLabel}`}
      {node.orderLabel && `, ${node.orderLabel}`}
      {'. '}
      {!node.isCenter && (
        <button onClick={() => onOpen(node.id)}>Open entity</button>
      )}
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <A11yListItem key={child.id} node={child} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── Utility ────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
