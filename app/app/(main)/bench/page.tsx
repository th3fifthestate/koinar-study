import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { getBenchBoards } from '@/lib/db/bench/queries'
import { getUserFlags } from '@/lib/bench/user-flags'
import { BoardDashboard } from '@/components/bench/board-dashboard'
import { BenchDashboardShell } from '@/components/bench/bench-dashboard-shell'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Study Bench',
  description: 'Your research canvas — organize verses, entities, and notes.',
}

export default async function BenchPage() {
  const session = await getCurrentUser()
  if (!session) redirect('/login')

  const boards = getBenchBoards(session.userId)
  const flags = getUserFlags(String(session.userId))

  return (
    <BenchDashboardShell>
      <BoardDashboard boards={boards} showWalkthrough={flags.has_seen_bench_intro === 0} />
    </BenchDashboardShell>
  )
}
