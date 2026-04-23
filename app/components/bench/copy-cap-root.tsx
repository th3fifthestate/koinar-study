'use client'

// app/components/bench/copy-cap-root.tsx
// Thin wrapper that activates the 100-verse clipboard cap for the bench canvas.
// currentTranslation: 'NIV' is used as a proxy — NIV is licensed, so the cap
// is always active. The bench may show multiple licensed translations; using any
// licensed translation as the key is DRM-correct (cap is uniform at 100 verses).
import { useCopyCap } from '@/components/shared/useCopyCap'
import type { DisplaySurface } from '@/lib/bench/types'

interface CopyCapRootProps {
  surface: DisplaySurface
  children: React.ReactNode
  className?: string
}

export function CopyCapRoot({ surface, children, className }: CopyCapRootProps) {
  const { containerRef } = useCopyCap({ surface, currentTranslation: 'NIV' })
  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  )
}
