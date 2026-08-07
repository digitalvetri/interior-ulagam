'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Lead } from '@/types/leads';
import { CustomerLeadView } from '../../_customer-lead-view';

export default function CustomerLeadByPhonePage() {
  const { phone }   = useParams<{ phone: string }>();
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(() => {
    fetch(`/api/v1/leads?phone=${encodeURIComponent(phone)}`)
      .then(r => r.json())
      .then(({ data }: { data: Lead[] | null }) => {
        const sorted = (data ?? []).sort(
          (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
        );
        setLeads(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [phone]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  return <CustomerLeadView leads={leads} loading={loading} refetch={fetchLeads} />;
}
