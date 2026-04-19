import { useMemo } from 'react'
import type { Camera } from '@/components/bench/canvas-camera'
import type { BenchClipping } from '@/lib/db/types'

const MARGIN = 200

interface Viewport { width: number; height: number }

export function useCanvasVisibility(
  camera: Camera,
  clippings: BenchClipping[],
  viewport: Viewport,
): BenchClipping[] {
  return useMemo(() => clippings.filter(c => {
    const sx = c.x * camera.zoom + camera.x
    const sy = c.y * camera.zoom + camera.y
    const sw = c.width * camera.zoom
    const sh = c.height * camera.zoom
    return (
      sx + sw >= -MARGIN &&
      sx <= viewport.width + MARGIN &&
      sy + sh >= -MARGIN &&
      sy <= viewport.height + MARGIN
    )
  }), [camera, clippings, viewport])
}
