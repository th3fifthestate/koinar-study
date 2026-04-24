"use client";

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WaitlistEntry {
  id: number;
  email: string;
  name: string;
  message: string | null;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  reviewed_at: string | null;
}

const STATUS_VARIANTS: Record<WaitlistEntry['status'], 'outline' | 'secondary' | 'destructive'> = {
  pending: 'outline',
  approved: 'secondary',
  denied: 'destructive',
};

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<{
    entry: WaitlistEntry;
    action: 'approve' | 'deny';
  } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch('/api/admin/waitlist')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load waitlist');
        return r.json();
      })
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => toast.error('Failed to load waitlist'))
      .finally(() => setLoading(false));
  }, []);

  const handleAction = async () => {
    if (!actionTarget) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/waitlist/${actionTarget.entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionTarget.action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Action failed');
      }
      const { entry: updated } = await res.json();
      setEntries((prev) =>
        prev.map((e) => (e.id === actionTarget.entry.id ? { ...e, ...updated } : e))
      );
      toast.success(
        actionTarget.action === 'approve'
          ? `Approved ${actionTarget.entry.name} — email sent`
          : `Denied ${actionTarget.entry.name}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setProcessing(false);
      setActionTarget(null);
    }
  };

  const columns: Column<WaitlistEntry>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (e) => <span className="font-medium">{e.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (e) => <span className="text-sm">{e.email}</span>,
    },
    {
      key: 'message',
      header: 'Message',
      render: (e) => (
        <span
          className="text-sm text-muted-foreground max-w-xs block truncate"
          title={e.message ?? ''}
        >
          {e.message ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => (
        <Badge variant={STATUS_VARIANTS[e.status]}>{e.status}</Badge>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (e) => (
        <span className="text-xs text-muted-foreground">
          {new Date(e.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (e) =>
        e.status === 'pending' ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActionTarget({ entry: e, action: 'approve' })}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActionTarget({ entry: e, action: 'deny' })}
            >
              Deny
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {e.reviewed_at ? new Date(e.reviewed_at).toLocaleDateString() : 'Reviewed'}
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Waitlist</h1>
      <DataTable
        columns={columns}
        data={entries}
        loading={loading}
        emptyMessage="No waitlist entries."
      />
      <AlertDialog
        open={!!actionTarget}
        onOpenChange={(open) => !open && setActionTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionTarget?.action === 'approve' ? 'Approve application?' : 'Deny application?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionTarget?.action === 'approve'
                ? `An approval email with a registration link will be sent to ${actionTarget?.entry.email}. The link expires in 7 days.`
                : `${actionTarget?.entry.name}'s application will be denied.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction} disabled={processing}>
              {processing ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
