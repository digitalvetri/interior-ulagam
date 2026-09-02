import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ElementType;
  accent?: boolean;
  className?: string;
}

export function StatCard({ label, value, sub, icon: Icon, accent = false, className }: StatCardProps) {
  return (
    <div
      className={cn('rounded-2xl p-4 flex flex-col gap-1', className)}
      style={{
        background: accent ? 'var(--accent-soft)' : 'var(--surface-card)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        {Icon && (
          <Icon
            className="h-4 w-4 flex-shrink-0"
            style={{ color: accent ? 'var(--accent-base)' : 'var(--text-tertiary)' }}
          />
        )}
      </div>
      <span
        className="text-2xl font-bold leading-none"
        style={{ color: accent ? 'var(--accent-base)' : 'var(--text-heading)' }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {sub}
        </span>
      )}
    </div>
  );
}
