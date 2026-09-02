import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  /** Convenience: stack N rows of this skeleton */
  rows?: number;
}

export function Skeleton({ className, rows }: SkeletonProps) {
  if (rows && rows > 1) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={className} />
        ))}
      </div>
    );
  }
  return (
    <div
      className={cn('animate-pulse rounded-lg', className)}
      style={{ background: 'var(--surface-muted)' }}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}
    >
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
