import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db/connection';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface WeekRow {
  week: string;
  count: number;
}

interface PopularStudyRow {
  title: string;
  slug: string;
  favorites: number;
}

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) redirect('/library');

  const db = getDb();

  const studiesPerWeek = db
    .prepare(
      `SELECT
         strftime('%Y-W%W', created_at) as week,
         COUNT(*) as count
       FROM studies
       WHERE created_at >= datetime('now', '-56 days')
       GROUP BY week
       ORDER BY week DESC`
    )
    .all() as WeekRow[];

  const popularStudies = db
    .prepare(
      `SELECT s.title, s.slug, COUNT(f.id) as favorites
       FROM studies s
       LEFT JOIN favorites f ON f.study_id = s.id
       WHERE s.is_public = 1
       GROUP BY s.id
       ORDER BY favorites DESC
       LIMIT 10`
    )
    .all() as PopularStudyRow[];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">Studies Created — Last 8 Weeks</h2>
        {studiesPerWeek.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="rounded-md border w-full max-w-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead className="text-right">Studies</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studiesPerWeek.map((row) => (
                  <TableRow key={row.week}>
                    <TableCell className="font-mono text-sm">{row.week}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Most Popular Studies (by Favorites)</h2>
        {popularStudies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No public studies yet.</p>
        ) : (
          <div className="rounded-md border w-full max-w-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Favorites</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {popularStudies.map((row) => (
                  <TableRow key={row.slug}>
                    <TableCell>
                      <a
                        href={`/study/${row.slug}`}
                        target="_blank"
                        className="hover:underline text-sm"
                      >
                        {row.title}
                      </a>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.favorites}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
