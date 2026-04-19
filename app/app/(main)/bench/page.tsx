import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { getBenchBoards } from '@/lib/db/bench/queries'
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

  return (
    <BenchDashboardShell>
      <BoardDashboard boards={boards} />
    </BenchDashboardShell>
  )
}
