"use client";

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Ban, Trash2 } from 'lucide-react';

interface AdminInviteCodeDTO {
  id: number;
  code: string;
  created_by_username: string;
  invitee_name: string;
  invitee_email: string;
  linked_study_title: string | null;
  linked_study_id: number | null;
  is_active: number;
  used_at: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function InviteCodesPage() {
  const [codes, setCodes] = useState<AdminInviteCodeDTO[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const fetchCodes = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/invite-codes?page=${page}&pageSize=50`);
      if (!res.ok) throw new Error('Failed to load invite codes');
      const data = await res.json();
      setCodes(data.items ?? []);
      setPagination({
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        totalPages: data.totalPages,
      });
    } catch {
      toast.error('Failed to load invite codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes(1);
  }, [fetchCodes]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied');
  };

  // Pending action per row to disable buttons mid-flight. Using a small
  // map rather than a single flag so two admins (or tabs) don't stomp each
  // other's spinners.
  const [pending, setPending] = useState<Record<number, 'invalidate' | 'delete' | undefined>>({});

  const invalidateInvite = async (c: AdminInviteCodeDTO) => {
    if (!window.confirm(`Invalidate the invite to ${c.invitee_email}? They won't be able to register with it anymore.`)) return;
    setPending((p) => ({ ...p, [c.id]: 'invalidate' }));
    try {
      const res = await fetch(`/api/admin/invite-codes/${c.id}`, { method: 'PATCH' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to invalidate');
      }
      toast.success('Invite invalidated');
      await fetchCodes(pagination.page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invalidate');
    } finally {
      setPending((p) => ({ ...p, [c.id]: undefined }));
    }
  };

  const deleteInvite = async (c: AdminInviteCodeDTO) => {
    if (!window.confirm(`Permanently delete the invite to ${c.invitee_email}? This cannot be undone.`)) return;
    setPending((p) => ({ ...p, [c.id]: 'delete' }));
    try {
      const res = await fetch(`/api/admin/invite-codes/${c.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to delete');
      }
      toast.success('Invite deleted');
      await fetchCodes(pagination.page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setPending((p) => ({ ...p, [c.id]: undefined }));
    }
  };

  const columns: Column<AdminInviteCodeDTO>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (c) => (
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
            {c.code.slice(0, 8)}…
          </code>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => copyCode(c.code)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
    {
      key: 'inviter',
      header: 'Inviter',
      render: (c) => <span className="text-sm">@{c.created_by_username}</span>,
    },
    {
      key: 'invitee',
      header: 'Invitee',
      render: (c) => (
        <div>
          <span className="text-sm font-medium">{c.invitee_name}</span>
          <br />
          <span className="text-xs text-muted-foreground">{c.invitee_email}</span>
        </div>
      ),
    },
    {
      key: 'study',
      header: 'Study',
      render: (c) =>
        c.linked_study_title ? (
          <span
            className="text-sm truncate max-w-[160px] block"
            title={c.linked_study_title}
          >
            {c.linked_study_title}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => {
        if (c.used_at) return <Badge variant="secondary">Used</Badge>;
        if (!c.is_active) return <Badge variant="outline">Inactive</Badge>;
        return <Badge>Active</Badge>;
      },
    },
    {
      key: 'created',
      header: 'Created',
      render: (c) => (
        <span className="text-xs text-muted-foreground">
          {new Date(c.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'used_at',
      header: 'Used',
      render: (c) => (
        <span className="text-xs text-muted-foreground">
          {c.used_at ? new Date(c.used_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c) => {
        const isUsed = Boolean(c.used_at);
        const isInactive = !c.is_active;
        const rowPending = pending[c.id];
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => invalidateInvite(c)}
              disabled={isUsed || isInactive || Boolean(rowPending)}
              title={
                isUsed
                  ? 'Already used'
                  : isInactive
                    ? 'Already inactive'
                    : 'Invalidate (soft — row retained)'
              }
            >
              <Ban className="h-3 w-3 mr-1" />
              {rowPending === 'invalidate' ? 'Working…' : 'Invalidate'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => deleteInvite(c)}
              disabled={isUsed || Boolean(rowPending)}
              title={isUsed ? 'Used invites cannot be deleted' : 'Delete permanently'}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {rowPending === 'delete' ? 'Working…' : 'Delete'}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invite Codes</h1>
        <span className="text-sm text-muted-foreground">{pagination.total} total</span>
      </div>
      <DataTable
        columns={columns}
        data={codes}
        loading={loading}
        pagination={
          pagination.totalPages > 1
            ? {
                page: pagination.page,
                totalPages: pagination.totalPages,
                onPageChange: fetchCodes,
              }
            : undefined
        }
        emptyMessage="No invite codes yet."
      />
    </div>
  );
}
