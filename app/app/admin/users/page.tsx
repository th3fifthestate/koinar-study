"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
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

interface AdminUserDTO {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  is_admin: number;
  is_approved: number;
  is_banned: number;
  created_at: string;
  study_count: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type ConfirmAction =
  | { type: 'grant_admin'; user: AdminUserDTO }
  | { type: 'revoke_admin'; user: AdminUserDTO }
  | { type: 'ban'; user: AdminUserDTO }
  | null;

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = useCallback(async (page: number, q: string) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (q) p.set('search', q);
      const res = await fetch(`/api/admin/users?${p}`);
      const data = await res.json();
      setUsers(data.items ?? []);
      setPagination({
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        totalPages: data.totalPages,
      });
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(1, '');
  }, [fetchUsers]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => fetchUsers(1, q), 300);
  };

  const patchUser = async (userId: number, patch: Record<string, boolean>) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Update failed');
    }
    const { user: updated } = await res.json();
    setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
  };

  const handleQuickAction = async (
    userId: number,
    patch: Record<string, boolean>,
    successMsg: string
  ) => {
    try {
      await patchUser(userId, patch);
      toast.success(successMsg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    setConfirmAction(null);
    try {
      if (type === 'grant_admin') await patchUser(user.id, { is_admin: true });
      if (type === 'revoke_admin') await patchUser(user.id, { is_admin: false });
      if (type === 'ban') await patchUser(user.id, { is_banned: true });
      toast.success('Done');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const columns: Column<AdminUserDTO>[] = [
    {
      key: 'username',
      header: 'Username',
      render: (u) => (
        <div>
          <span className="font-medium">{u.username}</span>
          {u.display_name && (
            <span className="text-xs text-muted-foreground ml-2">{u.display_name}</span>
          )}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (u) => <span className="text-sm">{u.email}</span>,
    },
    {
      key: 'studies',
      header: 'Studies',
      render: (u) => <span className="tabular-nums">{u.study_count}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <div className="flex gap-1 flex-wrap">
          {Boolean(u.is_admin) && <Badge>Admin</Badge>}
          {Boolean(u.is_approved) ? (
            <Badge variant="secondary">Approved</Badge>
          ) : (
            <Badge variant="outline">Pending</Badge>
          )}
          {Boolean(u.is_banned) && <Badge variant="destructive">Banned</Badge>}
        </div>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (u) => (
        <span className="text-xs text-muted-foreground">
          {new Date(u.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (u) => (
        <div className="flex gap-1 flex-wrap">
          {!u.is_approved && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleQuickAction(u.id, { is_approved: true }, `${u.username} approved`)
              }
            >
              Approve
            </Button>
          )}
          {u.is_banned ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                handleQuickAction(u.id, { is_banned: false }, `${u.username} unbanned`)
              }
            >
              Unban
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction({ type: 'ban', user: u })}
            >
              Ban
            </Button>
          )}
          {u.is_admin ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction({ type: 'revoke_admin', user: u })}
            >
              Revoke Admin
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction({ type: 'grant_admin', user: u })}
            >
              Grant Admin
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        searchPlaceholder="Search by username or email..."
        searchValue={search}
        onSearch={handleSearch}
        pagination={
          pagination.totalPages > 1
            ? {
                page: pagination.page,
                totalPages: pagination.totalPages,
                onPageChange: (p) => fetchUsers(p, search),
              }
            : undefined
        }
        emptyMessage="No users found."
      />

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'grant_admin' && 'Grant admin access?'}
              {confirmAction?.type === 'revoke_admin' && 'Revoke admin access?'}
              {confirmAction?.type === 'ban' && 'Ban this user?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'grant_admin' &&
                `${confirmAction.user.username} will have full admin access.`}
              {confirmAction?.type === 'revoke_admin' &&
                `${confirmAction.user.username} will lose admin access.`}
              {confirmAction?.type === 'ban' &&
                `${confirmAction.user.username} will be banned.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
