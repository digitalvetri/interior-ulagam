'use client';

import { Search, Inbox } from 'lucide-react';

interface EmptyStateProps {
  hasQuery?: boolean;
  /** Title shown when list is empty (not a search) */
  label?: string;
  /** Subtitle shown when list is empty */
  description?: string;
  /** Icon shown when list is empty */
  icon?: React.ElementType;
  /** Primary action button label */
  actionLabel?: string;
  /** Primary action (e.g. "Add first item", "Create") */
  onAction?: () => void;
  /** Label for the clear-search button (defaults to "Clear filters") */
  clearLabel?: string;
  /** Called when user clicks clear in the search-empty state */
  onClear?: () => void;
  /** Shown above the message in search-empty state */
  searchEmptyLabel?: string;
}

export function EmptyState({
  hasQuery = false,
  label = 'Nothing here yet',
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  clearLabel = 'Clear filters',
  onClear,
  searchEmptyLabel = 'No results match your search',
}: EmptyStateProps) {
  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'var(--surface-muted)' }}
        >
          <Search className="h-7 w-7" style={{ color: 'var(--text-secondary)' }} />
        </div>
        <p className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
          {searchEmptyLabel}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Try adjusting your search or filter criteria
        </p>
        {onClear && (
          <button
            onClick={onClear}
            className="mt-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
            style={{ background: 'var(--violet-primary)', color: '#fff' }}
          >
            {clearLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: 'var(--surface-muted)' }}
      >
        <Icon className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }} />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
          {label}
        </p>
        {description && (
          <p className="mt-1 text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
            {description}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
          style={{ background: 'var(--violet-primary)', color: '#fff' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
