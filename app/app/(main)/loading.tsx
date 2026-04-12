// app/app/(main)/loading.tsx
import { StudyCardSkeleton } from '@/components/library/study-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomeLoading() {
  return (
    <div className="min-h-dvh">
      {/* Hero skeleton */}
      <div className="h-dvh flex">
        <Skeleton className="w-[58%] h-full rounded-none" />
        <div className="flex-1 bg-[var(--stone-900)] p-12 flex flex-col justify-center gap-4">
          <Skeleton className="h-3 w-24 bg-[var(--stone-50)]/10" />
          <Skeleton className="h-12 w-64 bg-[var(--stone-50)]/10" />
          <Skeleton className="h-12 w-48 bg-[var(--stone-50)]/10" />
          <Skeleton className="h-px w-16 bg-[var(--stone-50)]/10 mt-8" />
          <Skeleton className="h-3 w-20 bg-[var(--stone-50)]/10 mt-4" />
          <Skeleton className="h-6 w-56 bg-[var(--stone-50)]/10" />
          <Skeleton className="h-4 w-72 bg-[var(--stone-50)]/10" />
        </div>
      </div>

      {/* Library skeleton */}
      <div className="mx-auto max-w-[1280px] px-10 py-12">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="flex gap-3 mb-6">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <StudyCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
