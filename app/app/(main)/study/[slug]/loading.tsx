import { Skeleton } from '@/components/ui/skeleton';

export default function StudyLoading() {
  return (
    <div>
      {/* Hero skeleton */}
      <Skeleton className="h-[40vh] w-full md:h-[60vh]" />

      <div className="mx-auto max-w-7xl px-4">
        {/* Header skeleton */}
        <div className="pt-8">
          <Skeleton className="h-12 w-3/4 md:h-14" />
          <Skeleton className="mt-3 h-5 w-full max-w-xl" />

          {/* Badge row */}
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>

          {/* Author + date */}
          <div className="mt-3 flex gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>

          <Skeleton className="mt-5 h-px w-full" />
        </div>

        {/* Content skeleton */}
        <div className="mt-8 flex gap-8">
          {/* TOC sidebar skeleton (desktop only) */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <Skeleton className="h-4 w-20" />
            <div className="mt-3 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-3" style={{ width: `${60 + Math.random() * 40}%` }} />
              ))}
            </div>
          </aside>

          {/* Main content skeleton */}
          <main className="min-w-0 flex-1">
            <div className="space-y-4 rounded-lg bg-muted/30 p-6 md:p-10">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-4" style={{ width: `${50 + Math.random() * 50}%` }} />
              ))}
              <Skeleton className="my-6 h-6 w-2/3" />
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={`b-${i}`} className="h-4" style={{ width: `${50 + Math.random() * 50}%` }} />
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
