'use client'
import { useState, useEffect } from 'react'

export type ViewportSize = 'mobile' | 'tablet' | 'desktop'

function classify(width: number): ViewportSize {
  if (width < 900) return 'mobile'
  if (width < 1280) return 'tablet'
  return 'desktop'
}

export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() =>
    classify(typeof window !== 'undefined' ? window.innerWidth : 1200)
  )

  useEffect(() => {
    const observer = new ResizeObserver(() => setSize(classify(window.innerWidth)))
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [])

  return size
}
