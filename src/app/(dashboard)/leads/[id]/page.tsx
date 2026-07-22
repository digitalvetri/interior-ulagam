'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lead, STAGE_LABELS, STAGE_COLORS } from '@/types/leads';
import { ArrowLeft, Calendar, ClipboardList } from 'lucide-react';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/leads/${id}`)
      .then(async (res) => {
        if (res.status === 404) { setNotFound(true); setLoading(false); return; }
        const { data } = (await res.json()) as { data: Lead };
        setLead(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-500 text-sm">Loading lead...</p>
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="p-6">
        <p className="text-gray-600 mb-4">Lead not found.</p>
        <Button variant="outline" onClick={() => router.push('/leads')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Pipeline
        </Button>
      </div>
    );
  }

  const isTerminal = lead.stage === 'won' || lead.stage === 'lost';

  return (
    <div className="p-6 max-w-2xl">
      <Link href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-4 w-4" />Back to Pipeline
      </Link>

      {isTerminal && (
        <div className={`mb-6 rounded-lg px-4 py-3 text-sm font-medium ${STAGE_COLORS[lead.stage]}`}>
          {lead.stage === 'won'
            ? 'This lead has been WON.'
            : `This lead was marked LOST${lead.lostReason ? `: ${lead.lostReason}` : '.'}`}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl">{lead.contactName}</CardTitle>
            <Badge className={STAGE_COLORS[lead.stage]}>{STAGE_LABELS[lead.stage]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <div>
            <span className="font-medium text-gray-500 w-28 inline-block">Phone</span>
            {lead.contactPhone}
          </div>
          <div>
            <span className="font-medium text-gray-500 w-28 inline-block">Source</span>
            {lead.source.replace('_', ' ')}
          </div>
          {lead.budgetBand && (
            <div>
              <span className="font-medium text-gray-500 w-28 inline-block">Budget</span>
              {lead.budgetBand}
            </div>
          )}
          {lead.notes && (
            <div>
              <span className="font-medium text-gray-500 w-28 inline-block align-top">Notes</span>
              <span className="inline-block max-w-md">{lead.notes}</span>
            </div>
          )}
          <div>
            <span className="font-medium text-gray-500 w-28 inline-block">Created</span>
            {new Date(lead.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </div>
          <div>
            <span className="font-medium text-gray-500 w-28 inline-block">Last Activity</span>
            {new Date(lead.lastActivityAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </div>
        </CardContent>
      </Card>

      {!isTerminal && (
        <div className="flex gap-3 flex-wrap">
          <Button asChild variant="outline">
            <Link href={`/leads/${id}/site-visit`}>
              <Calendar className="h-4 w-4 mr-2" />Schedule Site Visit
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/leads/${id}/requirements`}>
              <ClipboardList className="h-4 w-4 mr-2" />Requirements
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
