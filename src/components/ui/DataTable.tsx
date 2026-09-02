'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** Column width class, e.g. 'w-32' */
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  /** Externally controlled sort key */
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  className?: string;
}

const PAGE_SIZES = [20, 50, 100] as const;

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyState,
  onRowClick,
  sortKey: externalSortKey,
  sortDir: externalSortDir,
  onSort,
  className,
}: DataTableProps<T>) {
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(20);

  const activeSortKey = externalSortKey ?? internalSortKey;
  const activeSortDir = externalSortDir ?? internalSortDir;

  function handleSort(key: string) {
    const newDir = activeSortKey === key && activeSortDir === 'asc' ? 'desc' : 'asc';
    if (onSort) {
      onSort(key, newDir);
    } else {
      setInternalSortKey(key);
      setInternalSortDir(newDir);
    }
    setPage(0);
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(
    () => rows.slice(page * pageSize, (page + 1) * pageSize),
    [rows, page, pageSize],
  );

  function SortIcon({ colKey }: { colKey: string }) {
    if (activeSortKey !== colKey) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return activeSortDir === 'asc'
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  }

  if (loading) {
    return (
      <div className={cn('rounded-2xl overflow-hidden', className)}
        style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-5 py-4 border-b animate-pulse last:border-0"
            style={{ borderColor: 'var(--border-subtle)' }}>
            {columns.map((c) => (
              <div key={c.key} className="h-4 rounded flex-1" style={{ background: 'var(--surface-muted)' }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!rows.length && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--border-subtle)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-5 py-3 text-left font-semibold text-xs select-none',
                      col.width,
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.sortable && 'cursor-pointer hover:opacity-70',
                    )}
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable && <SortIcon colKey={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer',
                  )}
                  style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--surface-card)',
                  }}
                  onMouseEnter={onRowClick ? e => (e.currentTarget.style.background = 'var(--surface-hover)') : undefined}
                  onMouseLeave={onRowClick ? e => (e.currentTarget.style.background = 'var(--surface-card)') : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-5 py-4',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                      )}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {rows.length > 20 && (
        <div className="flex items-center justify-between pt-3 text-xs"
          style={{ color: 'var(--text-secondary)' }}>
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="rounded border px-1.5 py-0.5 text-xs"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)', color: 'var(--text-primary)' }}
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} of {rows.length}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="rounded px-2 py-1 disabled:opacity-40 hover:opacity-70"
                style={{ background: 'var(--surface-muted)' }}>
                ‹
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="rounded px-2 py-1 disabled:opacity-40 hover:opacity-70"
                style={{ background: 'var(--surface-muted)' }}>
                ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
