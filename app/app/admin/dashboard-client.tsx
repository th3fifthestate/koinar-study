"use client";

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { StatCard } from '@/components/admin/stat-card';

interface Stats {
  users: { total: number; approved: number; banned: number };
  waitlist: { pending: number };
  studies: { total: number; public: number; featured: number };
  images: { total: number };
  recentActivity: {
    action_type: string;
    target_type: string;
    created_at: string;
    admin_username: string;
  }[];
}

function formatActionLabel(action_type: string): string {
  return action_type.replace(/_/g, ' ');
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load stats');
        return r.json();
      })
      .then(setStats)
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Users</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatCard title="Total Users" value={stats.users.total} />
              <StatCard title="Approved" value={stats.users.approved} />
              <StatCard title="Banned" value={stats.users.banned} />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Studies</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatCard title="Total Studies" value={stats.studies.total} />
              <StatCard title="Public" value={stats.studies.public} />
              <StatCard title="Featured" value={stats.studies.featured} highlighted={stats.studies.featured > 0} />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Other</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatCard
                title="Pending Waitlist"
                value={stats.waitlist.pending}
                highlighted={stats.waitlist.pending > 0}
              />
              <StatCard title="Images" value={stats.images.total} />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent Activity</h2>
            {stats.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="rounded-lg border divide-y">
                {stats.recentActivity.map((item, i) => (
                  <div key={`${item.created_at}-${i}`} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium">{item.admin_username}</span>{' '}
                      <span className="text-muted-foreground">{formatActionLabel(item.action_type)}</span>
                      <span className="text-muted-foreground ml-1">
                        ({item.target_type})
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
