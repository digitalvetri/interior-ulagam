'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Lead } from '@/types/leads';
import { CustomerLeadView } from '../_customer-lead-view';

export default function CustomerLeadPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      // Primary fetch: leads explicitly linked to this customer
      const res = await fetch(`/api/v1/leads?customerId=${customerId}`);
      const { data } = await res.json() as { data: Lead[] | null };
      const linked = data ?? [];

      // Secondary fetch: leads with the same phone but customerId=null (created before fix)
      let unlinked: Lead[] = [];
      if (linked.length > 0) {
        const phone = linked[0].contactPhone;
        const res2 = await fetch(`/api/v1/leads?phone=${encodeURIComponent(phone)}`);
        const { data: data2 } = await res2.json() as { data: Lead[] | null };
        const linkedIds = new Set(linked.map(l => l.id));
        unlinked = (data2 ?? []).filter(l => !l.customerId && !linkedIds.has(l.id));
      }

      const all = [...linked, ...unlinked].sort(
        (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
      );
      setLeads(all);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  return <CustomerLeadView leads={leads} loading={loading} refetch={fetchLeads} />;
}
