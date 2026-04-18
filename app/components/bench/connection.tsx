'use client'

import { useState } from 'react'
import type { BenchClipping, BenchConnection } from '@/lib/db/types'

interface ConnectionLayerProps {
  connections: BenchConnection[]
  clippings: BenchClipping[]
  onDelete: (id: string) => void
}

function getCardCenter(c: BenchClipping): { x: number; y: number } {
  return { x: c.x + c.width / 2, y: c.y + c.height / 2 }
}

function cubicBezierPath(x0: number, y0: number, x1: number, y1: number): string {
  const dx = x1 - x0
  const dy = y1 - y0
  const cx1 = x0 + dx * 0.33
  const cy1 = y0 + dy * 0.08
  const cx2 = x1 - dx * 0.33
  const cy2 = y1 + dy * 0.08
  return `M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`
}

interface ArrowProps {
  conn: BenchConnection
  from: BenchClipping
  to: BenchClipping
  onDelete: (id: string) => void
}

function Arrow({ conn, from, to, onDelete }: ArrowProps) {
  const [hovered, setHovered] = useState(false)
  const p0 = getCardCenter(from)
  const p1 = getCardCenter(to)
  const path = cubicBezierPath(p0.x, p0.y, p1.x, p1.y)
  const midX = (p0.x + p1.x) / 2
  const midY = (p0.y + p1.y) / 2

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Invisible hit area for easier hovering */}
      <path d={path} stroke="transparent" strokeWidth={12} fill="none" />
      {/* Visible arrow */}
      <path
        d={path}
        stroke={hovered ? 'var(--sage-700, #4a6741)' : 'var(--sage-500, #6b8f61)'}
        strokeWidth={hovered ? 2 : 1.5}
        fill="none"
        markerEnd="url(#bench-arrowhead)"
      />
      {/* Label pill */}
      {conn.label && (
        <g>
          <rect
            x={midX - conn.label.length * 3.5 - 6}
            y={midY - 10}
            width={conn.label.length * 7 + 12}
            height={20}
            rx={4}
            fill="var(--ivory-paper, #fdfaf3)"
            stroke="var(--sage-300, #a8c4a0)"
            strokeWidth={1}
          />
          <text
            x={midX}
            y={midY + 4}
            textAnchor="middle"
            fontSize={11}
            fill="var(--foreground)"
            fontFamily="sans-serif"
          >
            {conn.label}
          </text>
        </g>
      )}
      {/* Delete button on hover */}
      {hovered && (
        <circle
          cx={midX + (conn.label ? conn.label.length * 3.5 + 14 : 10)}
          cy={midY - 8}
          r={7}
          fill="var(--destructive, #ef4444)"
          className="cursor-pointer"
          onClick={() => onDelete(conn.id)}
          role="button"
          aria-label="Delete connection"
        />
      )}
    </g>
  )
}

export function ConnectionLayer({ connections, clippings, onDelete }: ConnectionLayerProps) {
  const clippingMap = new Map(clippings.map((c) => [c.id, c]))
  const validConns = connections.filter(
    (cn) => clippingMap.has(cn.from_clipping_id) && clippingMap.has(cn.to_clipping_id)
  )

  if (validConns.length === 0 && clippings.length === 0) return null

  // Size SVG to contain all clippings + overflow
  const maxX = clippings.length > 0
    ? Math.max(...clippings.map((c) => c.x + c.width)) + 400
    : 2000
  const maxY = clippings.length > 0
    ? Math.max(...clippings.map((c) => c.y + c.height)) + 400
    : 2000

  return (
    <svg
      className="absolute top-0 left-0 overflow-visible"
      style={{ width: maxX, height: maxY, pointerEvents: 'none' }}
    >
      <defs>
        <marker
          id="bench-arrowhead"
          markerWidth="6"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M 0 0 L 6 4 L 0 8 Z" fill="var(--sage-500, #6b8f61)" />
        </marker>
      </defs>
      <g style={{ pointerEvents: 'all' }}>
        {validConns.map((conn) => (
          <Arrow
            key={conn.id}
            conn={conn}
            from={clippingMap.get(conn.from_clipping_id)!}
            to={clippingMap.get(conn.to_clipping_id)!}
            onDelete={onDelete}
          />
        ))}
      </g>
    </svg>
  )
}
