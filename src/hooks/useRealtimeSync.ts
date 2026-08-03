'use client';

import { useEffect, useRef } from 'react';

/**
 * Adds polling + server-sent change events to any data-fetching component.
 *
 * Usage:
 *   const refetch = useCallback(() => { fetch(...).then(setData) }, []);
 *   useRealtimeSync(['leads'], refetch);   // instant push + 30s fallback poll
 *
 * A single EventSource on /api/v1/events carries changes for every table; this
 * hook filters to the tables it was asked about and calls `onRefetch`. Events
 * come from Postgres triggers (migration 0002) and are scoped to the caller's
 * tenant server-side. Polling stays as a fallback: EventSource reconnects on its
 * own, but a poll means data is never more than `intervalMs` stale even if the
 * stream is down for a while.
 */
/** Window over which a burst of row-level events collapses into one refetch. */
const COALESCE_MS = 250;

export function useRealtimeSync(
  tables: string[],
  onRefetch: () => void,
  intervalMs = 30_000,
): void {
  // Stable ref — lets the polling/stream effects avoid listing onRefetch as a dep
  const refetchRef = useRef(onRefetch);
  useEffect(() => { refetchRef.current = onRefetch; }, [onRefetch]);

  // Polling fallback: re-fetch every intervalMs
  useEffect(() => {
    const id = setInterval(() => refetchRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  // tablesKey is a stable string derived from the (constant) tables array
  const tablesKey = tables.join(',');
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const watched = new Set(tablesKey.split(','));
    const source = new EventSource('/api/v1/events');

    // The Postgres triggers fire per row, so a bulk write (a backfill, a batch
    // job) emits one event per affected row. Coalesce them into a single
    // refetch instead of stampeding the API once per row.
    let coalesce: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefetch = () => {
      if (coalesce) return;
      coalesce = setTimeout(() => {
        coalesce = undefined;
        refetchRef.current();
      }, COALESCE_MS);
    };

    source.onmessage = (event) => {
      try {
        const { table } = JSON.parse(event.data) as { table?: string };
        if (table && watched.has(table)) scheduleRefetch();
      } catch {
        // Ignore anything unparseable rather than tearing the stream down.
      }
    };

    // EventSource retries automatically; nothing to do here beyond not crashing.
    source.onerror = () => { /* transient — the browser reconnects */ };

    return () => {
      if (coalesce) clearTimeout(coalesce);
      source.close();
    };
  }, [tablesKey]);
}
