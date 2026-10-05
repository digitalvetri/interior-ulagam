'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Banknote, AlertTriangle, Download, RefreshCw, Trash2 } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { responseError, NETWORK_ERROR } from '@/lib/client-feedback';

interface Payslip {
  id: string;
  userId: string;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  salaryPaise: number | null;
  daysPresent: string;
  daysAbsent: string;
  grossPaise: number;
  employeePFPaise: number;
  employeeESIPaise: number;
  netPaise: number;
  employerPFPaise: number;
  employerESIPaise: number;
  totalCostPaise: number;
}

interface PayrollRun {
  id: string;
  month: string;
  status: 'draft' | 'approved' | 'paid';
  workingDays: number;
  totalGrossPaise: number;
  totalNetPaise: number;
  totalCostPaise: number;
  notes: string | null;
  payslips: Payslip[];
}

const STATUS_STYLE: Record<PayrollRun['status'], { label: string; bg: string; fg: string }> = {
  draft:    { label: 'Draft',    bg: 'var(--surface-muted)',     fg: 'var(--text-secondary)' },
  approved: { label: 'Approved', bg: 'rgba(15,157,110,0.10)',   fg: '#0F6E4A' },
  paid:     { label: 'Paid',     bg: 'rgba(30,64,175,0.10)',    fg: '#1E40AF' },
};

function monthLabel(m: string) {
  const [year, mon] = m.split('-');
  return new Date(Number(year), Number(mon) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function fmt(paise: number) {
  return (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

export default function PayrollRunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/payroll/runs/${id}`);
      if (!res.ok) { setError('Payroll run not found'); return; }
      const json = await res.json() as { data: PayrollRun };
      setRun(json.data);
    } catch {
      setError('Failed to load payroll run');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function updateStatus(status: 'approved' | 'paid') {
    setUpdating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/payroll/runs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await load();
      else setActionError(await responseError(res, 'Could not update the payroll run.'));
    } catch {
      setActionError(NETWORK_ERROR);
    } finally {
      setUpdating(false);
    }
  }

  async function recalculate() {
    setUpdating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/payroll/runs/${id}/recalculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) await load();
      else setActionError(await responseError(res, 'Could not recalculate the payroll run.'));
    } catch {
      setActionError(NETWORK_ERROR);
    } finally {
      setUpdating(false);
    }
  }

  async function deleteDraft() {
    if (!window.confirm('Delete this draft payroll run? You can create it again afterwards.')) return;
    setUpdating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/payroll/runs/${id}`, { method: 'DELETE' });
      if (res.ok) { router.push('/payroll'); return; }
      setActionError(await responseError(res, 'Could not delete the payroll run.'));
    } catch {
      setActionError(NETWORK_ERROR);
    } finally {
      setUpdating(false);
    }
  }

  function downloadCSV() {
    if (!run) return;
    const rows = [
      ['Employee', 'Job Title', 'Department', 'Monthly Salary', 'Days Present', 'Days Absent',
       'Gross Pay', 'Emp PF', 'Emp ESI', 'Net Pay', 'Er PF', 'Er ESI', 'Total Cost'],
      ...run.payslips.map(p => [
        p.fullName,
        p.jobTitle ?? '',
        p.department ?? '',
        ((p.salaryPaise ?? 0) / 100).toFixed(2),
        p.daysPresent,
        p.daysAbsent,
        (p.grossPaise / 100).toFixed(2),
        (p.employeePFPaise / 100).toFixed(2),
        (p.employeeESIPaise / 100).toFixed(2),
        (p.netPaise / 100).toFixed(2),
        (p.employerPFPaise / 100).toFixed(2),
        (p.employerESIPaise / 100).toFixed(2),
        (p.totalCostPaise / 100).toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${run.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl h-16 animate-pulse"
            style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }} />
        ))}
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-[13px]" style={{ color: '#DC2626' }}>{error ?? 'Not found'}</p>
      </div>
    );
  }

  const s = STATUS_STYLE[run.status];
  // Based on what was actually computed for this run, not the live salary.
  const missingSalary = run.payslips.filter(p => p.grossPaise === 0);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button type="button" onClick={() => router.push('/payroll')}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-3"
            style={{ color: 'var(--text-secondary)' }}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Payroll
          </button>
          <div className="flex items-center gap-3">
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-heading)', letterSpacing: '-0.03em' }}>
              {monthLabel(run.month)}
            </h1>
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ background: s.bg, color: s.fg }}>
              {s.label}
            </span>
          </div>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {run.workingDays} working days · {run.payslips.length} employees
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={downloadCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          {run.status === 'draft' && (
            <>
              <button type="button" onClick={() => void deleteDraft()} disabled={updating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors disabled:opacity-50"
                style={{ borderColor: '#FCA5A5', color: '#B91C1C', background: 'var(--surface-card)' }}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete Draft
              </button>
              <button type="button" onClick={() => void recalculate()} disabled={updating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[13px] font-medium border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'var(--surface-card)' }}>
                <RefreshCw className="h-3.5 w-3.5" />
                Recalculate
              </button>
            </>
          )}
          {run.status === 'draft' && (
            <button type="button" onClick={() => void updateStatus('approved')} disabled={updating}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] disabled:opacity-50">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {updating ? 'Saving…' : 'Approve'}
            </button>
          )}
          {run.status === 'approved' && (
            <button type="button" onClick={() => void updateStatus('paid')} disabled={updating}
              className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] disabled:opacity-50">
              <Banknote className="h-3.5 w-3.5" />
              {updating ? 'Saving…' : 'Mark as Paid'}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <p className="text-[13px]" style={{ color: '#DC2626' }}>{actionError}</p>
      )}

      {/* Missing salary warning */}
      {missingSalary.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-[12px]"
          style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)', color: '#92400E' }}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
          <span>
            {missingSalary.length} employee{missingSalary.length > 1 ? 's have' : ' has'} ₹0 gross pay in this run
            ({missingSalary.map(p => p.fullName).join(', ')}) — no salary set or no attendance recorded.
            {run.status === 'draft'
              ? ' Fix it in Employees / Attendance, then click Recalculate.'
              : ' This run is no longer a draft.'}
          </span>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Gross', value: run.totalGrossPaise, color: 'var(--text-heading)' },
          { label: 'Employee Deductions', value: run.totalGrossPaise - run.totalNetPaise, color: '#DC2626' },
          { label: 'Total Net Pay', value: run.totalNetPaise, color: 'var(--accent-base)' },
          { label: 'Total Employer Cost', value: run.totalCostPaise, color: 'var(--text-secondary)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-3.5" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
            <p className="text-[16px] font-bold tnum leading-tight" style={{ color }}>{formatRupees(value)}</p>
          </div>
        ))}
      </div>

      {/* Payslips table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                {['Employee', 'Days Present', 'Days Absent', 'Gross', 'Emp PF', 'Emp ESI', 'Net Pay', 'Er PF', 'Er ESI', 'Total Cost'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {run.payslips.map((p, i) => (
                <tr key={p.id}
                  style={{
                    borderBottom: i < run.payslips.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    background: i % 2 === 0 ? 'var(--surface-card)' : 'var(--surface-app)',
                  }}>
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: 'var(--text-heading)' }}>{p.fullName}</p>
                    {(p.jobTitle || p.department) && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {[p.jobTitle, p.department].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 tnum" style={{ color: 'var(--text-heading)' }}>{p.daysPresent}</td>
                  <td className="px-4 py-3 tnum" style={{ color: Number(p.daysAbsent) > 0 ? '#DC2626' : 'var(--text-secondary)' }}>
                    {p.daysAbsent}
                  </td>
                  <td className="px-4 py-3 tnum font-medium" style={{ color: 'var(--text-heading)' }}>₹{fmt(p.grossPaise)}</td>
                  <td className="px-4 py-3 tnum" style={{ color: '#DC2626' }}>₹{fmt(p.employeePFPaise)}</td>
                  <td className="px-4 py-3 tnum" style={{ color: '#DC2626' }}>₹{fmt(p.employeeESIPaise)}</td>
                  <td className="px-4 py-3 tnum font-bold" style={{ color: 'var(--accent-base)' }}>₹{fmt(p.netPaise)}</td>
                  <td className="px-4 py-3 tnum" style={{ color: 'var(--text-secondary)' }}>₹{fmt(p.employerPFPaise)}</td>
                  <td className="px-4 py-3 tnum" style={{ color: 'var(--text-secondary)' }}>₹{fmt(p.employerESIPaise)}</td>
                  <td className="px-4 py-3 tnum font-medium" style={{ color: 'var(--text-secondary)' }}>₹{fmt(p.totalCostPaise)}</td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr style={{ background: 'var(--surface-muted)', borderTop: '2px solid var(--border-subtle)' }}>
                <td className="px-4 py-3 font-bold text-[12px]" style={{ color: 'var(--text-heading)' }}>Total</td>
                <td colSpan={2} />
                <td className="px-4 py-3 tnum font-bold" style={{ color: 'var(--text-heading)' }}>₹{fmt(run.totalGrossPaise)}</td>
                <td className="px-4 py-3 tnum font-bold" style={{ color: '#DC2626' }}>
                  ₹{fmt(run.payslips.reduce((s, p) => s + p.employeePFPaise, 0))}
                </td>
                <td className="px-4 py-3 tnum font-bold" style={{ color: '#DC2626' }}>
                  ₹{fmt(run.payslips.reduce((s, p) => s + p.employeeESIPaise, 0))}
                </td>
                <td className="px-4 py-3 tnum font-bold" style={{ color: 'var(--accent-base)' }}>₹{fmt(run.totalNetPaise)}</td>
                <td className="px-4 py-3 tnum font-bold" style={{ color: 'var(--text-secondary)' }}>
                  ₹{fmt(run.payslips.reduce((s, p) => s + p.employerPFPaise, 0))}
                </td>
                <td className="px-4 py-3 tnum font-bold" style={{ color: 'var(--text-secondary)' }}>
                  ₹{fmt(run.payslips.reduce((s, p) => s + p.employerESIPaise, 0))}
                </td>
                <td className="px-4 py-3 tnum font-bold" style={{ color: 'var(--text-secondary)' }}>₹{fmt(run.totalCostPaise)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {run.notes && (
        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-medium">Note:</span> {run.notes}
        </p>
      )}
    </div>
  );
}
