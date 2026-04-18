'use client'

import { useState, useCallback, createContext, useContext } from 'react'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 2

export interface Camera {
  x: number
  y: number
  zoom: number
}

export interface CanvasCameraControls {
  camera: Camera
  setZoom: (z: number) => void
  pan: (x: number, y: number) => void
  zoomAtPoint: (vpX: number, vpY: number, nextZoom: number) => void
  reset: () => void
  transformStyle: string
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

export function useCanvasCamera(initial: Camera): CanvasCameraControls {
  const [camera, setCamera] = useState<Camera>(initial)

  const setZoom = useCallback((z: number) => {
    setCamera((prev) => ({ ...prev, zoom: clampZoom(z) }))
  }, [])

  const pan = useCallback((x: number, y: number) => {
    setCamera((prev) => ({ ...prev, x, y }))
  }, [])

  const zoomAtPoint = useCallback((vpX: number, vpY: number, nextZoom: number) => {
    setCamera((prev) => {
      const clamped = clampZoom(nextZoom)
      // Keep the world point under (vpX, vpY) fixed:
      // worldX = (vpX - prev.x) / prev.zoom
      // newX   = vpX - worldX * clamped
      const worldX = (vpX - prev.x) / prev.zoom
      const worldY = (vpY - prev.y) / prev.zoom
      return {
        x: vpX - worldX * clamped,
        y: vpY - worldY * clamped,
        zoom: clamped,
      }
    })
  }, [])

  const reset = useCallback(() => setCamera({ x: 0, y: 0, zoom: 1 }), [])

  const transformStyle = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`

  return { camera, setZoom, pan, zoomAtPoint, reset, transformStyle }
}

// ── Context ──────────────────────────────────────────────────────────────────

export interface BenchCanvasContextValue extends CanvasCameraControls {
  boardId: string
}

export const BenchCanvasContext = createContext<BenchCanvasContextValue | null>(null)

export function useBenchCanvas(): BenchCanvasContextValue {
  const ctx = useContext(BenchCanvasContext)
  if (!ctx) throw new Error('useBenchCanvas must be used within BenchCanvasContext.Provider')
  return ctx
}
