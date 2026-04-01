import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-4 rounded-2xl">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="glass-card p-6 rounded-2xl">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-[350px] w-full rounded-xl" />
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="glass-card p-4 rounded-2xl">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
