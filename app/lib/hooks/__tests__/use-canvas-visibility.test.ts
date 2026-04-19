// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useCanvasVisibility } from '@/lib/hooks/use-canvas-visibility'
import type { Camera } from '@/components/bench/canvas-camera'
import type { BenchClipping } from '@/lib/db/types'

function clip(id: string, x: number, y: number): BenchClipping {
  return { id, x, y, width: 200, height: 150 } as BenchClipping
}

const VP = { width: 1200, height: 800 }
const CAM: Camera = { x: 0, y: 0, zoom: 1 }

describe('useCanvasVisibility', () => {
  it('includes clippings inside the viewport', () => {
    const { result } = renderHook(() =>
      useCanvasVisibility(CAM, [clip('a', 0, 0)], VP)
    )
    expect(result.current.map(c => c.id)).toContain('a')
  })

  it('includes clippings within the 200px margin', () => {
    // screen x = 1300 — outside viewport but within 200px margin
    const { result } = renderHook(() =>
      useCanvasVisibility(CAM, [clip('c', 1300, 0)], VP)
    )
    expect(result.current.map(c => c.id)).toContain('c')
  })

  it('excludes clippings far outside the viewport', () => {
    const { result } = renderHook(() =>
      useCanvasVisibility(CAM, [clip('b', 2000, 0)], VP)
    )
    expect(result.current.map(c => c.id)).not.toContain('b')
  })

  it('accounts for camera offset', () => {
    // world x=-500 + cameraX=400 → screen x=-100 → within 200px margin → visible
    const { result } = renderHook(() =>
      useCanvasVisibility({ x: 400, y: 0, zoom: 1 }, [clip('d', -500, 0)], VP)
    )
    expect(result.current.map(c => c.id)).toContain('d')
  })
})
