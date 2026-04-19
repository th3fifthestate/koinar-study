'use client'
import { useViewportSize } from '@/lib/hooks/use-viewport-size'
import { MobileReadOnlyBanner } from './empty-states/mobile-readonly-banner'

export function BenchDashboardShell({ children }: { children: React.ReactNode }) {
  const viewport = useViewportSize()
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {viewport === 'mobile' && <MobileReadOnlyBanner />}
      {children}
    </div>
  )
}
