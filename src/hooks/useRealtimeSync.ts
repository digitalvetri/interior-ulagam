'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Adds polling + Supabase Realtime subscriptions to any data-fetching component.
 *
 * Usage:
 *   const refetch = useCallback(() => { fetch(...).then(setData) }, []);
 *   useRealtimeSync(['leads'], refetch);   // instant push + 30s fallback poll
 *
 * The hook sets up one Supabase channel for all tables. When any subscribed
 * table changes (INSERT/UPDATE/DELETE), `onRefetch` is called immediately.
 * Polling runs every `intervalMs` as a fallback for environments where the
 * Supabase Realtime publication is not fully configured.
 */
export function useRealtimeSync(
  tables: string[],
  onRefetch: () => void,
  intervalMs = 30_000,
): void {
  // Stable ref — lets polling/subscription effects avoid listing onRefetch as a dep
  const refetchRef = useRef(onRefetch);
  useEffect(() => { refetchRef.current = onRefetch; }, [onRefetch]);

  // Polling fallback: re-fetch every intervalMs
  useEffect(() => {
    const id = setInterval(() => refetchRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  // Supabase Realtime: instant invalidation on any row change
  // tablesKey is a stable string derived from the (constant) tables array
  const tablesKey = tables.join(',');
  useEffect(() => {
    const tableList = tablesKey.split(',');
    const supabase = createClient();
    const channel = supabase.channel(`rt-${tablesKey}`);

    for (const table of tableList) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => refetchRef.current(),
      );
    }

    channel.subscribe();
    return () => void supabase.removeChannel(channel);
  }, [tablesKey]);
}
