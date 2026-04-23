"use client";

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AdminGiftCodeDTO {
  id: number;
  code: string;
  recipient_username: string;
  format_locked: 'simple' | 'standard' | 'comprehensive';
  max_uses: number;
  uses_remaining: number;
  created_at: string;
  expires_at: string | null;
  status: 'active' | 'depleted' | 'expired';
}

interface SimpleUser {
  id: number;
  username: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_VARIANTS = {
  active: 'default' as const,
  depleted: 'outline' as const,
  expired: 'destructive' as const,
};

const FORMAT_VARIANTS = {
  simple: 'outline' as const,
  standard: 'secondary' as const,
  comprehensive: 'default' as const,
};

export default function GiftCodesPage() {
  const [codes, setCodes] = useState<AdminGiftCodeDTO[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    user_id: '',
    format_locked: 'standard' as 'simple' | 'standard' | 'comprehensive',
    max_uses: '1',
    expires_at: '',
  });

  const fetchCodes = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/gift-codes?page=${page}&pageSize=50`);
      if (!res.ok) throw new Error('Failed to load gift codes');
      const data = await res.json();
      setCodes(data.items ?? []);
      setPagination({
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        totalPages: data.totalPages,
      });
    } catch {
      toast.error('Failed to load gift codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCodes(1);
  }, [fetchCodes]);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users?pageSize=200');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.items ?? []);
    } catch {
      toast.error('Failed to load users');
    }
  };

  const openCreate = () => {
    loadUsers();
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.user_id) {
      toast.error('Select a recipient');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/gift-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: parseInt(form.user_id, 10),
          format_locked: form.format_locked,
          max_uses: parseInt(form.max_uses, 10),
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create');
      }
      toast.success('Gift code created');
      setShowCreate(false);
      setForm({ user_id: '', format_locked: 'standard', max_uses: '1', expires_at: '' });
      fetchCodes(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create gift code');
    } finally {
      setCreating(false);
    }
  };

  const columns: Column<AdminGiftCodeDTO>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (c) => (
        <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
          {c.code.slice(0, 12)}…
        </code>
      ),
    },
    {
      key: 'recipient',
      header: 'Recipient',
      render: (c) => <span className="text-sm">@{c.recipient_username}</span>,
    },
    {
      key: 'format',
      header: 'Format',
      render: (c) => (
        <Badge variant={FORMAT_VARIANTS[c.format_locked]}>{c.format_locked}</Badge>
      ),
    },
    {
      key: 'uses',
      header: 'Uses',
      render: (c) => (
        <span className="text-sm tabular-nums">
          {c.uses_remaining} / {c.max_uses}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Badge variant={STATUS_VARIANTS[c.status]}>{c.status}</Badge>
      ),
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
      key: 'expires',
      header: 'Expires',
      render: (c) => (
        <span className="text-xs text-muted-foreground">
          {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gift Codes</h1>
        <Button onClick={openCreate}>Create Gift Code</Button>
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
        emptyMessage="No gift codes yet."
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Gift Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Recipient User</Label>
              <Select
                value={form.user_id}
                onValueChange={(v) => setForm((f) => ({ ...f, user_id: v ?? '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      @{u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Format</Label>
              <Select
                value={form.format_locked}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    format_locked: v as typeof form.format_locked,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max Uses</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.max_uses}
                onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
              />
            </div>
            <div>
              <Label>Expiration Date (optional)</Label>
              <Input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
