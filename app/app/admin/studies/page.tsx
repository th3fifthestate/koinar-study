"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DataTable, type Column } from '@/components/admin/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Eye, EyeOff, StarOff, Trash2 } from 'lucide-react';
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

interface AdminStudyDTO {
  id: number;
  title: string;
  slug: string;
  is_public: number;
  is_featured: number;
  created_at: string;
  created_by_username: string;
  category_name: string | null;
  tags: string | null;
  favorite_count: number;
  annotation_count: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function StudiesPage() {
  const [studies, setStudies] = useState<AdminStudyDTO[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminStudyDTO | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStudies = useCallback(async (page: number, q: string) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (q) p.set('search', q);
      const res = await fetch(`/api/admin/studies?${p}`);
      const data = await res.json();
      setStudies(data.items ?? []);
      setPagination({
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        totalPages: data.totalPages,
      });
    } catch {
      toast.error('Failed to load studies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudies(1, '');
  }, [fetchStudies]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => fetchStudies(1, q), 300);
  };

  const patchStudy = async (
    studyId: number,
    patch: { is_featured?: boolean; is_public?: boolean }
  ) => {
    const res = await fetch(`/api/admin/studies/${studyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Update failed');
    }
    const { study: updated } = await res.json();
    setStudies((prev) => prev.map((s) => (s.id === studyId ? { ...s, ...updated } : s)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/studies/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setStudies((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.title}" deleted`);
    } catch {
      toast.error('Failed to delete study');
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns: Column<AdminStudyDTO>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (s) => (
        <div>
          <Link
            href={`/study/${s.slug}`}
            className="font-medium hover:underline text-sm"
            target="_blank"
          >
            {s.title}
          </Link>
          <div className="text-xs text-muted-foreground mt-0.5">
            @{s.created_by_username}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (s) =>
        s.category_name ? (
          <Badge variant="outline" className="text-xs">
            {s.category_name}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (s) => {
        const tags = s.tags ? s.tags.split(',').filter(Boolean) : [];
        if (tags.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex gap-1 flex-wrap max-w-[160px]">
            {tags.slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                {t}
              </Badge>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'stats',
      header: 'Favs / Notes',
      render: (s) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {s.favorite_count} / {s.annotation_count}
        </span>
      ),
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (s) => (
        <div className="flex gap-1">
          {Boolean(s.is_featured) && <Badge>Featured</Badge>}
          {Boolean(s.is_public) ? (
            <Badge variant="secondary">Public</Badge>
          ) : (
            <Badge variant="outline">Private</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (s) => (
        <span className="text-xs text-muted-foreground">
          {new Date(s.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            title={s.is_featured ? 'Unfeature' : 'Feature'}
            onClick={async () => {
              try {
                await patchStudy(s.id, { is_featured: !s.is_featured });
                toast.success(s.is_featured ? 'Unfeatured' : 'Featured');
              } catch {
                toast.error('Update failed');
              }
            }}
          >
            {s.is_featured ? (
              <StarOff className="h-4 w-4" />
            ) : (
              <Star className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title={s.is_public ? 'Make Private' : 'Make Public'}
            onClick={async () => {
              try {
                await patchStudy(s.id, { is_public: !s.is_public });
                toast.success(s.is_public ? 'Set to private' : 'Published');
              } catch {
                toast.error('Update failed');
              }
            }}
          >
            {s.is_public ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Delete"
            onClick={() => setDeleteTarget(s)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Studies</h1>

      <DataTable
        columns={columns}
        data={studies}
        loading={loading}
        searchPlaceholder="Search by title or summary..."
        searchValue={search}
        onSearch={handleSearch}
        pagination={
          pagination.totalPages > 1
            ? {
                page: pagination.page,
                totalPages: pagination.totalPages,
                onPageChange: (p) => fetchStudies(p, search),
              }
            : undefined
        }
        emptyMessage="No studies found."
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete study?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently deleted along with all its
              annotations, favorites, tags, and images. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
