// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasCamera } from '../canvas-camera'

describe('useCanvasCamera', () => {
  it('initializes with provided camera values', () => {
    const { result } = renderHook(() => useCanvasCamera({ x: 10, y: 20, zoom: 1.5 }))
    expect(result.current.camera).toEqual({ x: 10, y: 20, zoom: 1.5 })
  })

  it('clamps zoom max to 2', () => {
    const { result } = renderHook(() => useCanvasCamera({ x: 0, y: 0, zoom: 1 }))
    act(() => result.current.setZoom(5))
    expect(result.current.camera.zoom).toBe(2)
  })

  it('clamps zoom min to 0.25', () => {
    const { result } = renderHook(() => useCanvasCamera({ x: 0, y: 0, zoom: 1 }))
    act(() => result.current.setZoom(0.1))
    expect(result.current.camera.zoom).toBe(0.25)
  })

  it('pan updates x and y', () => {
    const { result } = renderHook(() => useCanvasCamera({ x: 0, y: 0, zoom: 1 }))
    act(() => result.current.pan(50, 30))
    expect(result.current.camera.x).toBe(50)
    expect(result.current.camera.y).toBe(30)
  })

  it('zoomAtPoint adjusts pan to keep world point under cursor stable', () => {
    const { result } = renderHook(() => useCanvasCamera({ x: 0, y: 0, zoom: 1 }))
    act(() => result.current.zoomAtPoint(100, 100, 2))
    const { x, y, zoom } = result.current.camera
    expect(zoom).toBe(2)
    // world point = (vpX - panX) / zoom must equal original worldX = (100 - 0) / 1 = 100
    expect((100 - x) / zoom).toBeCloseTo(100)
    expect((100 - y) / zoom).toBeCloseTo(100)
  })

  it('zoomAtPoint clamps result zoom to bounds', () => {
    const { result } = renderHook(() => useCanvasCamera({ x: 0, y: 0, zoom: 1 }))
    act(() => result.current.zoomAtPoint(0, 0, 10))
    expect(result.current.camera.zoom).toBe(2)
  })

  it('reset returns to identity', () => {
    const { result } = renderHook(() => useCanvasCamera({ x: 50, y: 80, zoom: 1.5 }))
    act(() => result.current.reset())
    expect(result.current.camera).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('transformStyle returns correct CSS', () => {
    const { result } = renderHook(() => useCanvasCamera({ x: 10, y: 20, zoom: 0.5 }))
    expect(result.current.transformStyle).toBe('translate(10px, 20px) scale(0.5)')
  })
})
