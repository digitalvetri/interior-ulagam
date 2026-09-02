'use client';

import { cn } from '@/lib/utils';
import { STATUS_MAPS, StatusModule } from '@/lib/status-maps';

interface StatusBadgeProps {
  module: StatusModule;
  status: string;
  className?: string;
}

export function StatusBadge({ module, status, className }: StatusBadgeProps) {
  const map = STATUS_MAPS[module];
  const cfg = map[status] ?? { label: status, bg: 'var(--surface-muted)', color: 'var(--text-secondary)' };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        className,
      )}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.dot && (
        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      )}
      {cfg.label}
    </span>
  );
}
