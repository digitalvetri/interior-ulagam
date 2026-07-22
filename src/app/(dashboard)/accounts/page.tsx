'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupees } from '@/lib/utils';
import type { ReceivableItem } from '@/types/accounts';

interface ReceivablesPayload {
  items: ReceivableItem[];
  totalOutstandingPaise: number;
  totalOverduePaise: number;
}

const STATUS_STYLES: Record<'pending' | 'link_sent' | 'overdue', string> = {
  pending: 'bg-gray-100 text-gray-700 border-gray-200',
  link_sent: 'bg-blue-100 text-blue-700 border-blue-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABELS: Record<'pending' | 'link_sent' | 'overdue', string> = {
  pending: 'Pending',
  link_sent: 'Link Sent',
  overdue: 'Overdue',
};

export default function AccountsPage() {
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [receivables, setReceivables] = useState<ReceivablesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [xmlExportError, setXmlExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchReceivables = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const url = `/api/v1/accounts/receivables${overdueOnly ? '?overdueOnly=true' : ''}`;
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) setFetchError('Failed to load receivables');
          return;
        }
        const json = (await res.json()) as { data: ReceivablesPayload };
        if (!cancelled) setReceivables(json.data);
      } catch {
        if (!cancelled) setFetchError('Network error — please try again');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchReceivables();

    return () => {
      cancelled = true;
    };
  }, [overdueOnly]);

  const handleExportTallyXml = async () => {
    setXmlExportError(null);
    try {
      const res = await fetch('/api/v1/accounts/tally-xml-push');
      if (!res.ok) {
        setXmlExportError('XML export failed — please try again');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tally-vouchers.xml';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setXmlExportError('XML export failed — network error');
    }
  };

  const handleExportTally = async () => {
    setExportError(null);
    try {
      const res = await fetch('/api/v1/accounts/tally-export');
      if (!res.ok) {
        setExportError('Export failed — please try again');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tally-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Export failed — network error');
    }
  };

  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
      </div>

      {/* Receivables Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Receivables</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOverdueOnly((prev) => !prev)}
          >
            {overdueOnly ? 'Show All' : 'Show Overdue Only'}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">
                {receivables ? formatRupees(receivables.totalOutstandingPaise) : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">
                {receivables ? formatRupees(receivables.totalOverduePaise) : '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Receivables Table */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {loading && (
            <div className="p-8 text-center text-sm text-gray-500">
              Loading receivables…
            </div>
          )}
          {fetchError && !loading && (
            <div className="p-8 text-center text-sm text-red-600">{fetchError}</div>
          )}
          {!loading && !fetchError && receivables && receivables.items.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-500">
              {overdueOnly ? 'No overdue milestones.' : 'No outstanding receivables.'}
            </div>
          )}
          {!loading && !fetchError && receivables && receivables.items.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Milestone
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    Age
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {receivables.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {item.projectName}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{item.label}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatRupees(item.amountPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[item.paymentStatus]}
                      >
                        {STATUS_LABELS[item.paymentStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {item.daysSinceCreation} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Tally Export Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Tally Export</h2>
        <p className="text-sm text-gray-500">
          Download all captured payments as a CSV for import into Tally ERP.
        </p>
        <Button onClick={handleExportTally}>Export to Tally CSV</Button>
        {exportError && (
          <p className="text-sm text-red-600">{exportError}</p>
        )}
      </section>

      {/* Tally XML Push Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Tally XML Push</h2>
        <p className="text-sm text-gray-500">
          Download XML for direct import into Tally ERP via XML import (File &rarr; Import &rarr; Vouchers)
        </p>
        <Button onClick={handleExportTallyXml}>Export Tally XML</Button>
        {xmlExportError && (
          <p className="text-sm text-red-600">{xmlExportError}</p>
        )}
      </section>
    </div>
  );
}
