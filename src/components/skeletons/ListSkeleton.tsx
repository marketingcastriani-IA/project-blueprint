import { Skeleton } from '@/components/ui/skeleton';

export default function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>

      {/* Cards list */}
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="glass-card p-5 rounded-2xl flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
