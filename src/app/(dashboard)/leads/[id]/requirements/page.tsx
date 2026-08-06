'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RequirementRow } from '@/components/requirements/RequirementRow';
import { AddRequirementForm } from '@/components/requirements/AddRequirementForm';
import type { RequirementRow as RequirementRowType, RoomEntry } from '@/types/site-visits';

interface LeadSummary {
  contactName: string;
}

export default function RequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [lead, setLead] = useState<LeadSummary | null>(null);
  const [reqRow, setReqRow] = useState<RequirementRowType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [leadRes, reqRes] = await Promise.all([
        fetch(`/api/v1/leads/${id}`),
        fetch(`/api/v1/requirements?leadId=${id}`),
      ]);

      if (!leadRes.ok) throw new Error(`Failed to load lead (${leadRes.status})`);
      if (!reqRes.ok) throw new Error(`Failed to load requirements (${reqRes.status})`);

      const { data: leadData } = (await leadRes.json()) as { data: LeadSummary };
      const { data: reqData } = (await reqRes.json()) as { data: RequirementRowType | null };

      setLead(leadData);
      setReqRow(reqData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
      console.error('[RequirementsPage]', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void fetchData(); }, [fetchData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const rooms: RoomEntry[] = reqRow?.roomsJson ?? [];

  async function handleEditRoom(index: number, updated: RoomEntry) {
    if (!reqRow) return;
    const newRooms = rooms.map((r, i) => (i === index ? updated : r));
    const res = await fetch(`/api/v1/requirements/${reqRow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rooms: newRooms }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? 'Update failed');
    }
    const { data } = (await res.json()) as { data: RequirementRowType };
    setReqRow(data);
  }

  async function handleDeleteRoom(index: number) {
    if (!reqRow) return;
    const newRooms = rooms.filter((_, i) => i !== index);
    if (newRooms.length === 0) {
      const res = await fetch(`/api/v1/requirements/${reqRow.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setReqRow(null);
    } else {
      const res = await fetch(`/api/v1/requirements/${reqRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms: newRooms }),
      });
      if (!res.ok) throw new Error('Delete failed');
      const { data } = (await res.json()) as { data: RequirementRowType };
      setReqRow(data);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/leads/${id}`} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] ">
          ← Back to Lead
        </Link>
        <h1 className="text-2xl font-bold text-[var(--text-heading)] dark:text-white">
          Requirements{lead ? ` — ${lead.contactName}` : ''}
        </h1>
      </div>

      {loading && <p className="text-sm text-[var(--text-secondary)] ">Loading…</p>}
      {!loading && error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && (
        <>
          <p className="text-sm text-[var(--text-secondary)] ">
            {rooms.length === 0
              ? 'No rooms captured yet.'
              : `${rooms.length} room${rooms.length === 1 ? '' : 's'} captured`}
          </p>

          {rooms.length > 0 && (
            <div className="space-y-3">
              {rooms.map((room, i) => (
                <RequirementRow
                  key={i}
                  room={room}
                  onEdit={(updated) => handleEditRoom(i, updated)}
                  onDelete={() => handleDeleteRoom(i)}
                />
              ))}
            </div>
          )}

          <AddRequirementForm leadId={id} onSuccess={(row) => setReqRow(row)} />
        </>
      )}
    </div>
  );
}
