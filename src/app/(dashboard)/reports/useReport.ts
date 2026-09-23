'use client';
import { useState, useEffect } from 'react';

export function useReport<T>(report: string, from: string, to: string) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams();
    if (from) sp.set('from', from);
    if (to)   sp.set('to', to);
    fetch(`/api/v1/reports/${report}?${sp}`)
      .then(r => r.json())
      .then(j => { if (!cancelled) { setData(j.data ?? null); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [report, from, to]);

  return { data, loading, error };
}
