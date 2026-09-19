'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3, ChevronDown, Download, FileSpreadsheet,
  HandCoins, IndianRupee, MoreVertical,
  Plus, Receipt, TrendingDown, TrendingUp, Wallet, CheckCircle2,
  Clock, Building2, Search,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RecordPaymentDrawer } from '@/components/finance/RecordPaymentDrawer';
import { Button } from '@/components/ui/button';
import { OverviewTab } from './_OverviewTab';
import type { OverviewData, VendorPayableRow } from './_OverviewTab';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'to-collect' | 'received' | 'to-pay' | 'expenses' | 'gst';

interface InvoiceRow {
  id: string; projectId: string; projectName: string; clientName: string | null;
  invoiceNumber: string; invoiceDate: string; issuedAt: string | null;
  dueDate: string | null; status: string;
  subtotalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number;
  isInterstate: boolean; pdfUrl: string | null;
}

interface ReceivedRow {
  id: string; receiptNumber: string | null; receivedAt: string | null;
  createdAt: string; amountPaise: number; status: string; mode: string | null;
  reference: string | null; note: string | null;
  invoiceId: string | null; invoiceNumber: string | null;
  projectId: string | null; projectName: string | null;
  customerId: string | null; clientName: string | null;
}

interface ToCollectRow {
  id: string; projectId: string; projectName: string;
  label: string; amountPaise: number;
  paymentStatus: 'pending' | 'link_sent' | 'overdue';
  createdAt: string; daysSinceCreation: number;
  daysLate: number; dueDate: string | null;
  clientName: string | null; clientPhone: string | null;
  promisedAt: string | null; lastContactedAt: string | null;
  healthStatus: string | null; customerId: string | null;
}

interface ExpenseRow {
  id: string; projectId: string; category: string; amountPaise: number;
  description: string | null; vendorName: string | null; gstPct: number;
  gstAmountPaise: number; createdAt: string; paidAt: string | null;
  dueDate: string | null; expenseNumber: string | null; receiptUrl: string | null;
}

interface GstSummary {
  outputPaise: number; inputPaise: number; netPaise: number;
  cgstPaise: number; sgstPaise: number; igstPaise: number;
}
interface GstOutputRow {
  id: string; invoiceNumber: string; issuedAt: string | null;
  subtotalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number;
  projectName: string | null; clientName: string | null;
  hsnSacLinesJson: unknown;
}
interface GstExpenseRow {
  id: string; expenseNumber: string | null; description: string | null;
  category: string; gstPct: number; amountPaise: number; gstAmountPaise: number;
  paidAt: string | null; createdAt: string;
}
interface GstHsnLine {
  hsnSac?: string | null; amountPaise: number;
  cgstPaise?: number; sgstPaise?: number; igstPaise?: number;
}
interface GstData {
  year: number; month: number; summary: GstSummary;
  outputRows: GstOutputRow[]; inputRows: GstExpenseRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'overview',   label: 'Overview',    icon: Wallet      },
  { key: 'to-collect', label: 'To Collect',  icon: TrendingUp  },
  { key: 'received',   label: 'Received',    icon: HandCoins   },
  { key: 'to-pay',     label: 'To Pay',      icon: TrendingDown },
  { key: 'expenses',   label: 'Expenses',    icon: Receipt     },
  { key: 'gst',        label: 'GST',         icon: BarChart3   },
];

const EXP_LABEL: Record<string, string> = {
  petty_cash: 'Petty Cash', transport: 'Transport',
  labour: 'Labour', material: 'Material', other: 'Other',
};

const CAT_DOT: Record<string, string> = {
  petty_cash: '#f97316',
  transport:  '#3b82f6',
  labour:     '#10b981',
  material:   '#8b5cf6',
  other:      '#94a3b8',
};

const MODE_COLOR: Record<string, { bg: string; color: string }> = {
  upi:      { bg: 'rgba(99,102,241,0.12)',  color: '#4f46e5' },
  cash:     { bg: 'rgba(16,185,129,0.12)',  color: '#059669' },
  bank:     { bg: 'rgba(59,130,246,0.12)',  color: '#2563eb' },
  cheque:   { bg: 'rgba(245,158,11,0.12)',  color: '#b45309' },
  card:     { bg: 'rgba(236,72,153,0.12)',  color: '#be185d' },
  razorpay: { bg: 'rgba(79,70,229,0.12)',   color: '#4338ca' },
};

const TODAY = new Date().toISOString().split('T')[0];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined, fallback = '—') {
  if (!iso) return fallback;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[80, 60, 90, 70, 55].map((w, i) => (
        <div key={i} className="flex gap-3 items-center">
          <div className="h-10 rounded-xl flex-1" style={{ background: 'var(--surface-muted)' }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--surface-muted)' }}>
        <Icon className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{title}</p>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>
    </div>
  );
}

function KpiCard({
  label, value, sub, href, accent, icon: Icon,
}: {
  label: string; value: string; sub?: string; href?: string;
  accent?: string; icon?: React.ElementType;
}) {
  const inner = (
    <div className="relative rounded-2xl border p-5 overflow-hidden flex flex-col gap-1.5"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
      {accent && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: accent }} />
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
        {Icon && (
          <div className="h-8 w-8 rounded-xl flex items-center justify-center"
            style={{ background: accent ? `${accent}18` : 'var(--surface-muted)' }}>
            <Icon className="h-4 w-4" style={{ color: accent ?? 'var(--text-tertiary)' }} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent ?? 'var(--text-heading)' }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
      {href && (
        <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--accent-base)' }}>View all →</p>
      )}
    </div>
  );
  if (href) return <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link>;
  return inner;
}

function ModeBadge({ mode }: { mode: string | null }) {
  if (!mode) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  const cfg = MODE_COLOR[mode] ?? { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' };
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: cfg.bg, color: cfg.color }}>
      {mode}
    </span>
  );
}

function ActionsMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
        style={{ color: 'var(--text-tertiary)' }}>
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 min-w-[160px] rounded-xl border py-1 shadow-xl"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          {items.map(item => (
            <button key={item.label} onClick={() => { item.onClick(); setOpen(false); }}
              className="flex w-full items-center px-4 py-2.5 text-sm hover:opacity-70 transition-opacity text-left"
              style={{ color: item.danger ? 'var(--danger)' : 'var(--text-primary)' }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── To Collect Tab ───────────────────────────────────────────────────────────

type AgingFilter = 'all' | '0-30' | '31-60' | '60+';

function waLink(phone: string | null, clientName: string | null, projectName: string): string {
  const num = (phone ?? '').replace(/\D/g, '');
  const name = clientName ?? projectName;
  const msg = encodeURIComponent(`Hi ${name}, this is a gentle reminder about the pending payment for ${projectName}. Please let us know when you can arrange it. Thank you!`);
  return `https://wa.me/${num}?text=${msg}`;
}

const WA_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.556 4.115 1.528 5.845L.057 23.882l6.204-1.626A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.817 9.817 0 01-5.003-1.373l-.358-.213-3.722.976.994-3.632-.234-.373A9.786 9.786 0 012.182 12C2.182 6.578 6.578 2.182 12 2.182S21.818 6.578 21.818 12 17.422 21.818 12 21.818z"/>
  </svg>
);

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f97316','#14b8a6','#3b82f6','#10b981','#f43f5e'];

function ClientAvatar({ name }: { name: string }) {
  const idx = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex-shrink-0 flex items-center justify-center rounded-full text-[13px] font-bold text-white"
      style={{ width: 40, height: 40, background: AVATAR_COLORS[idx] }}>
      {initials || '?'}
    </div>
  );
}

const HEALTH_CFG: Record<string, { label: string; bg: string; color: string }> = {
  hot:      { label: 'Hot',      bg: '#fff7ed', color: '#c2410c' },
  healthy:  { label: 'Healthy',  bg: '#f0fdf4', color: '#15803d' },
  at_risk:  { label: 'At Risk',  bg: '#fff1f2', color: '#be123c' },
  inactive: { label: 'Inactive', bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
};

function HealthBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const c = HEALTH_CFG[status];
  if (!c) return null;
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function DarkKpiCard({ label, value, sub, gradient, icon: Icon }: {
  label: string; value: string; sub?: string; gradient: string; icon?: React.ElementType;
}) {
  return (
    <div className="rounded-2xl p-4 relative overflow-hidden flex-shrink-0 min-w-[156px]"
      style={{ background: gradient }}>
      {Icon && <Icon className="absolute right-3 top-3 opacity-[0.18]" style={{ width: 34, height: 34, color: '#fff' }} />}
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
        style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</p>
      <p className="text-[20px] font-bold text-white tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{sub}</p>}
    </div>
  );
}

function CollectionDonut({ overduePaise, linkSentPaise, notYetDuePaise }: {
  overduePaise: number; linkSentPaise: number; notYetDuePaise: number;
}) {
  const total = overduePaise + linkSentPaise + notYetDuePaise;
  const fmtS = (p: number) => {
    const r = p / 100;
    if (r >= 100_000) return `₹${(r / 100_000).toFixed(1)}L`;
    if (r >= 1_000)   return `₹${(r / 1_000).toFixed(0)}K`;
    return `₹${Math.round(r)}`;
  };
  const SEGS = [
    { paise: overduePaise,   color: '#ef4444', label: 'Overdue'     },
    { paise: linkSentPaise,  color: '#f59e0b', label: 'Link Sent'   },
    { paise: notYetDuePaise, color: '#14b8a6', label: 'Not Yet Due' },
  ];
  if (total === 0) return (
    <div className="flex flex-col items-center py-2">
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={42} fill="none" stroke="var(--border-subtle)" strokeWidth={13} />
      </svg>
      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>No data</p>
    </div>
  );
  const CX = 55, CY = 55, R = 42, SW = 13;
  let cursor = -90;
  const arcs = SEGS.filter(s => s.paise > 0).map(seg => {
    const angle = (seg.paise / total) * 360;
    const a1 = cursor * (Math.PI / 180);
    const a2 = (cursor + angle - 0.8) * (Math.PI / 180);
    const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
    const x2 = CX + R * Math.cos(a2), y2 = CY + R * Math.sin(a2);
    const large = angle > 180 ? 1 : 0;
    cursor += angle;
    return { d: `M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2}`, color: seg.color };
  });
  return (
    <div>
      <div className="flex justify-center mb-3">
        <svg width={110} height={110} viewBox="0 0 110 110">
          {arcs.map((a, i) => (
            <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={SW} strokeLinecap="round" />
          ))}
          <text x={55} y={51} textAnchor="middle" fill="var(--text-heading)" fontSize={12} fontWeight={700}>{fmtS(total)}</text>
          <text x={55} y={65} textAnchor="middle" fill="var(--text-tertiary)" fontSize={8.5}>total</text>
        </svg>
      </div>
      <div className="space-y-2">
        {SEGS.map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            </div>
            <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{fmtS(s.paise)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToCollectTab({ onRefresh }: { onRefresh?: () => void }) {
  const [rows, setRows]             = useState<ToCollectRow[]>([]);
  const [totals, setTotals]         = useState({ totalOutstandingPaise: 0, totalOverduePaise: 0, linkSentPaise: 0, notYetDuePaise: 0 });
  const [loading, setLoading]       = useState(true);
  const [aging, setAging]           = useState<AgingFilter>('all');
  const [drawer, setDrawer]         = useState<{ open: boolean; item?: ToCollectRow }>({ open: false });
  const [recentPmts, setRecentPmts] = useState<Array<{ id: string; clientName: string | null; amountPaise: number; mode: string | null; createdAt: string; status: string }>>([]);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/accounts/receivables')
      .then(r => r.json())
      .then(b => {
        setRows((b.data?.items ?? []) as ToCollectRow[]);
        setTotals({
          totalOutstandingPaise: b.data?.totalOutstandingPaise ?? 0,
          totalOverduePaise:     b.data?.totalOverduePaise     ?? 0,
          linkSentPaise:         b.data?.linkSentPaise         ?? 0,
          notYetDuePaise:        b.data?.notYetDuePaise        ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/v1/payments?limit=5')
      .then(r => r.json())
      .then(b => { if (Array.isArray(b.data)) setRecentPmts(b.data.slice(0, 5)); })
      .catch(() => {});
  }, []);

  const AGING_FILTERS: { key: AgingFilter; label: string }[] = [
    { key: 'all',   label: 'All'        },
    { key: '0-30',  label: '0–30 late'  },
    { key: '31-60', label: '31–60 late' },
    { key: '60+',   label: '60+ late'   },
  ];

  const displayed = rows.filter(r => {
    if (aging === '0-30')  return r.daysLate >= 1  && r.daysLate <= 30;
    if (aging === '31-60') return r.daysLate >= 31 && r.daysLate <= 60;
    if (aging === '60+')   return r.daysLate > 60;
    return true;
  });

  const clientCount = new Set(rows.map(r => r.clientName ?? r.projectId)).size;

  if (loading) return <TabSkeleton />;

  return (
    <div className="flex gap-5 items-start">

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-5">

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            label="Total Outstanding" icon={Wallet}
            value={formatRupees(totals.totalOutstandingPaise)}
            sub={`${clientCount} client${clientCount !== 1 ? 's' : ''}`}
          />
          <KpiCard
            label="Overdue" icon={TrendingUp}
            value={formatRupees(totals.totalOverduePaise)}
            sub={`${rows.filter(r => r.daysLate > 0).length} milestone${rows.filter(r => r.daysLate > 0).length !== 1 ? 's' : ''}`}
            accent="var(--error)"
          />
          <KpiCard
            label="Link Sent" icon={IndianRupee}
            value={formatRupees(totals.linkSentPaise)}
            sub={`${rows.filter(r => r.paymentStatus === 'link_sent').length} sent`}
          />
          <KpiCard
            label="Not Yet Due" icon={Clock}
            value={formatRupees(totals.notYetDuePaise)}
            sub={`${rows.filter(r => r.paymentStatus === 'pending' && r.daysLate === 0).length} pending`}
          />
        </div>

        {/* Filter pills + section heading */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 15 }}>⚡</span>
            <h3 className="text-[15px] font-bold" style={{ color: 'var(--text-heading)' }}>
              Chase these today
            </h3>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}>
              {displayed.length}
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {AGING_FILTERS.map(f => (
              <button key={f.key} onClick={() => setAging(f.key)}
                className="rounded-full px-3 py-1 text-[12px] font-semibold border transition-colors"
                style={{
                  background:  aging === f.key ? 'var(--text-heading)' : 'transparent',
                  color:       aging === f.key ? 'var(--surface-app)'  : 'var(--text-secondary)',
                  borderColor: aging === f.key ? 'var(--text-heading)' : 'var(--border-subtle)',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row list */}
        {displayed.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing to collect" sub="All caught up!" />
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {displayed.map((r, idx) => {
              const displayName = r.clientName ?? r.projectName;
              return (
                <div key={r.id} className="px-5 py-4"
                  style={{
                    background:   'var(--surface-card)',
                    borderBottom: idx < displayed.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>

                  {/* Avatar + info + badge + amount */}
                  <div className="flex items-center gap-3">
                    <ClientAvatar name={displayName} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-bold leading-snug" style={{ color: 'var(--text-heading)' }}>
                          {displayName}
                          {r.clientName && r.projectName !== r.clientName && (
                            <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>
                              {' '}— {r.projectName}
                            </span>
                          )}
                        </p>
                        <HealthBadge status={r.healthStatus} />
                      </div>
                      <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {r.label}
                        {r.daysLate > 0 && (
                          <span className="font-semibold ml-1.5" style={{ color: '#f97316' }}>
                            · {r.daysLate}d late
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-[17px] font-bold tabular-nums flex-shrink-0"
                      style={{ color: 'var(--text-heading)', letterSpacing: '-0.01em' }}>
                      {formatRupees(r.amountPaise)}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    <a href={waLink(r.clientPhone, r.clientName, r.projectName)}
                      target="_blank" rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold border transition-opacity hover:opacity-80"
                      style={{ borderColor: '#86efac', color: '#16a34a', background: '#f0fdf4' }}>
                      {WA_ICON}WhatsApp
                    </a>
                    <button
                      onClick={() => setDrawer({ open: true, item: r })}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold border transition-opacity hover:opacity-80"
                      style={{ borderColor: 'var(--accent-base)', color: 'var(--accent-base)', background: 'var(--accent-soft)' }}>
                      <IndianRupee className="h-3 w-3" />Record Payment
                    </button>
                    <Link href={`/projects/${r.projectId}`}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold border transition-colors"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'transparent' }}>
                      <Receipt className="h-3 w-3" />View Project
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right sidebar ───────────────────────────────────────────── */}
      <div className="w-64 flex-shrink-0 space-y-4 sticky top-4">

        {/* Quick Actions */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--text-tertiary)' }}>Quick Actions</p>
          <div className="space-y-2">
            <button
              onClick={() => setDrawer({ open: true })}
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors"
              style={{ background: 'var(--accent-base)', color: '#fff' }}>
              <Plus className="h-4 w-4 flex-shrink-0" />Record Payment
            </button>
            <Link href="/invoices"
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold border transition-colors"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'transparent' }}>
              <Receipt className="h-4 w-4 flex-shrink-0" />View Invoices
            </Link>
            <Link href="/customers"
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold border transition-colors"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-heading)', background: 'transparent' }}>
              <Building2 className="h-4 w-4 flex-shrink-0" />All Clients
            </Link>
          </div>
        </div>

        {/* Collection Summary donut */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--text-tertiary)' }}>Collection Summary</p>
          <CollectionDonut
            overduePaise={totals.totalOverduePaise}
            linkSentPaise={totals.linkSentPaise}
            notYetDuePaise={totals.notYetDuePaise}
          />
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
            style={{ color: 'var(--text-tertiary)' }}>Recent Activity</p>
          {recentPmts.length === 0 ? (
            <p className="text-xs py-1" style={{ color: 'var(--text-tertiary)' }}>No recent payments</p>
          ) : (
            <div className="space-y-3">
              {recentPmts.map(p => {
                const captured = p.status === 'captured';
                const dt = new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                return (
                  <div key={p.id} className="flex items-start gap-2.5">
                    <span className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: captured ? '#16a34a' : '#f97316' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold leading-snug truncate"
                        style={{ color: 'var(--text-heading)' }}>
                        {captured ? 'Payment received' : 'Payment pending'}
                        {p.clientName ? ` from ${p.clientName}` : ''}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {formatRupees(p.amountPaise)} · {dt}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <RecordPaymentDrawer
        open={drawer.open}
        onClose={() => setDrawer({ open: false })}
        contextLabel={drawer.item ? `${drawer.item.projectName} — ${drawer.item.label}` : undefined}
        defaultAmountPaise={drawer.item?.amountPaise}
        defaultInvoiceId={drawer.item?.id}
        defaultProjectId={drawer.item?.projectId}
        onSuccess={() => { setDrawer({ open: false }); load(); onRefresh?.(); }}
      />
    </div>
  );
}

// ─── Received Tab ─────────────────────────────────────────────────────────────

const MODE_PILLS = [
  { key: 'upi',        label: 'UPI'         },
  { key: 'cash',       label: 'Cash'        },
  { key: 'bank',       label: 'Bank (NEFT)' },
  { key: 'cheque',     label: 'Cheque'      },
  { key: 'card',       label: 'Card'        },
  { key: 'razorpay',   label: 'Razorpay'    },
  { key: 'not-linked', label: 'Not linked'  },
];

function ReceivedTab({ onOpen }: { onOpen: () => void }) {
  const [rows, setRows]       = useState<ReceivedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modeFilter, setMode] = useState<string>('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/payments')
      .then(r => r.json())
      .then(b => setRows((b.data ?? []) as ReceivedRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const captured   = rows.filter(r => r.status === 'captured');
  const totalPaise = captured.reduce((s, r) => s + r.amountPaise, 0);

  const filtered = captured.filter(r => {
    if (!modeFilter)                return true;
    if (modeFilter === 'not-linked') return !r.invoiceId && !r.projectId;
    return r.mode === modeFilter;
  });

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-5">

      {/* Header row: total on left, filter pills on right */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
            style={{ color: 'var(--text-tertiary)' }}>Payments Received</p>
          <p className="text-4xl font-bold tabular-nums"
            style={{ color: 'var(--text-heading)', letterSpacing: '-0.03em' }}>
            {formatRupees(totalPaise)}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {captured.length} payment{captured.length !== 1 ? 's' : ''} in total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {MODE_PILLS.map(p => (
            <button key={p.key}
              onClick={() => setMode(prev => prev === p.key ? '' : p.key)}
              className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold border transition-colors"
              style={{
                background:  modeFilter === p.key ? 'var(--text-heading)' : 'transparent',
                color:       modeFilter === p.key ? 'var(--surface-app)'  : 'var(--text-secondary)',
                borderColor: modeFilter === p.key ? 'var(--text-heading)' : 'var(--border-subtle)',
              }}>
              {p.label}
            </button>
          ))}
          <button onClick={onOpen}
            className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold ml-1"
            style={{ background: 'var(--accent-base)', color: '#fff' }}>
            <Plus className="h-3.5 w-3.5" />Record
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState icon={HandCoins} title="No payments received" sub="Recorded payments will appear here" />
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-muted)', borderBottom: '2px solid var(--border-subtle)' }}>
                  {[
                    { label: 'Number',          align: 'left'  },
                    { label: 'Date',            align: 'left'  },
                    { label: 'Client',          align: 'left'  },
                    { label: 'For',             align: 'left'  },
                    { label: 'Mode',            align: 'left'  },
                    { label: 'Reference',       align: 'left'  },
                    { label: 'On a Bill',       align: 'right' },
                    { label: 'Against the Job', align: 'right' },
                    { label: 'Total',           align: 'right' },
                  ].map(h => (
                    <th key={h.label}
                      className={`px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap text-${h.align}`}
                      style={{ color: 'var(--text-tertiary)' }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const onBill    = r.invoiceId ? r.amountPaise : null;
                  const againstJob = !r.invoiceId && r.projectId ? r.amountPaise : null;
                  const forLabel  = r.invoiceId
                    ? (r.invoiceNumber ?? 'Bill')
                    : (r.projectName ?? '—');

                  return (
                    <tr key={r.id}
                      style={{
                        background:   'var(--surface-card)',
                        borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        cursor: 'default',
                      }}>
                      {/* Number */}
                      <td className="px-4 py-3.5 font-semibold tabular-nums whitespace-nowrap"
                        style={{ color: 'var(--text-heading)' }}>
                        {r.receiptNumber ?? '—'}
                      </td>
                      {/* Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap"
                        style={{ color: 'var(--text-secondary)' }}>
                        {fmtDate(r.receivedAt ?? r.createdAt, '—')}
                      </td>
                      {/* Client */}
                      <td className="px-4 py-3.5 font-medium" style={{ color: 'var(--text-heading)', maxWidth: 180 }}>
                        <span className="truncate block">{r.clientName ?? '—'}</span>
                      </td>
                      {/* For */}
                      <td className="px-4 py-3.5" style={{ maxWidth: 180 }}>
                        {r.invoiceId
                          ? <Link href={`/invoices/${r.invoiceId}`}
                              className="font-semibold hover:underline truncate block"
                              style={{ color: 'var(--accent-base)' }}>
                              {forLabel}
                            </Link>
                          : <span className="truncate block" style={{ color: 'var(--text-secondary)' }}>{forLabel}</span>
                        }
                      </td>
                      {/* Mode */}
                      <td className="px-4 py-3.5">
                        <ModeBadge mode={r.mode} />
                      </td>
                      {/* Reference */}
                      <td className="px-4 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                        {r.reference ?? '—'}
                      </td>
                      {/* On a Bill */}
                      <td className="px-4 py-3.5 text-right tabular-nums"
                        style={{ color: onBill != null ? 'var(--text-heading)' : 'var(--text-tertiary)', fontWeight: onBill != null ? 600 : 400 }}>
                        {onBill != null ? formatRupees(onBill) : '—'}
                      </td>
                      {/* Against the Job */}
                      <td className="px-4 py-3.5 text-right tabular-nums"
                        style={{ color: againstJob != null ? 'var(--text-heading)' : 'var(--text-tertiary)', fontWeight: againstJob != null ? 600 : 400 }}>
                        {againstJob != null ? formatRupees(againstJob) : '—'}
                      </td>
                      {/* Total */}
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold"
                        style={{ color: 'var(--text-heading)' }}>
                        {formatRupees(r.amountPaise)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── To Pay Tab ───────────────────────────────────────────────────────────────

type EnrichedExpense = ExpenseRow & { daysLate: number };

function ToPayTab() {
  const [rows, setRows]       = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/expenses?unpaid=true')
      .then(r => r.json())
      .then(b => setRows((b.data ?? []) as ExpenseRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const [now] = useState(() => Date.now());

  const enriched: EnrichedExpense[] = rows.map(r => {
    const ref = r.dueDate ? new Date(r.dueDate) : new Date(r.createdAt);
    return { ...r, daysLate: Math.max(0, Math.floor((now - ref.getTime()) / 86_400_000)) };
  });

  const totalPaise   = enriched.reduce((s, r) => s + r.amountPaise, 0);
  const overduePaise = enriched.filter(r => r.daysLate > 0).reduce((s, r) => s + r.amountPaise, 0);
  const dueThisWeek  = enriched.filter(r =>
    r.daysLate === 0 && r.dueDate &&
    new Date(r.dueDate).getTime() - now < 7 * 86_400_000
  ).length;

  async function markPaid(id: string) {
    setMarking(prev => new Set(prev).add(id));
    try {
      await fetch(`/api/v1/expenses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paidAt: new Date().toISOString() }),
      });
      setRows(prev => prev.filter(r => r.id !== id));
    } catch { /* noop */ } finally {
      setMarking(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  function fmtLong(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
          style={{ color: 'var(--text-tertiary)' }}>To Pay</p>
        <p className="text-4xl font-bold tabular-nums"
          style={{ color: 'var(--text-heading)', letterSpacing: '-0.03em' }}>
          {formatRupees(totalPaise)}
        </p>
        <p className="text-sm mt-1.5 flex items-center gap-1.5 flex-wrap">
          {overduePaise > 0 ? (
            <span className="font-semibold" style={{ color: '#ef4444' }}>
              {formatRupees(overduePaise)} is overdue
            </span>
          ) : (
            <span style={{ color: 'var(--text-secondary)' }}>Nothing overdue</span>
          )}
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {dueThisWeek === 0 ? 'None due this week' : `${dueThisWeek} due this week`}
          </span>
        </p>
      </div>

      {/* List */}
      {enriched.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="All caught up" sub="No outstanding expenses to pay" />
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>

          {/* Group header */}
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-heading)' }}>
              Outstanding expenses
            </p>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold tabular-nums">{enriched.length}</span>
              <span className="mx-2" style={{ color: 'var(--text-tertiary)' }}>·</span>
              <span className="font-semibold tabular-nums">{formatRupees(totalPaise)}</span>
            </p>
          </div>

          {/* Rows */}
          {enriched.map((r, idx) => (
            <div key={r.id}
              className="flex items-center gap-4 px-5 py-4"
              style={{
                background:   'var(--surface-card)',
                borderBottom: idx < enriched.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}>

              {/* Description + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold leading-snug"
                  style={{ color: 'var(--text-heading)' }}>
                  {r.description ?? r.vendorName ?? '—'}
                </p>
                <p className="text-[12px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {EXP_LABEL[r.category] ?? r.category}
                  </span>
                  {r.daysLate > 0 && (
                    <>
                      <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                      <span className="font-semibold" style={{ color: '#f97316' }}>
                        {r.daysLate} day{r.daysLate !== 1 ? 's' : ''} late
                      </span>
                    </>
                  )}
                  <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {fmtLong(r.dueDate ?? r.createdAt)}
                  </span>
                </p>
              </div>

              {/* Amount + Mark paid */}
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <p className="text-[15px] font-bold tabular-nums"
                  style={{ color: 'var(--text-heading)' }}>
                  {formatRupees(r.amountPaise)}
                </p>
                <button
                  onClick={() => markPaid(r.id)}
                  disabled={marking.has(r.id)}
                  className="rounded-lg border px-3 py-1 text-[12px] font-semibold transition-colors"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    color:       'var(--text-secondary)',
                    background:  marking.has(r.id) ? 'var(--surface-muted)' : 'transparent',
                    opacity:     marking.has(r.id) ? 0.6 : 1,
                    cursor:      marking.has(r.id) ? 'not-allowed' : 'pointer',
                  }}>
                  {marking.has(r.id) ? 'Saving…' : 'Mark paid'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

const CATS_LIST = ['petty_cash', 'transport', 'labour', 'material', 'other'] as const;

function fmtCompact(paise: number) {
  const r = paise / 100;
  if (r >= 1_00_000) return `₹${(r / 1_00_000).toFixed(1)}L`;
  if (r >= 1_000)    return `₹${(r / 1_000).toFixed(1)}K`;
  return `₹${Math.round(r)}`;
}

function ExpensesTab() {
  const [rows, setRows]       = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCat]   = useState<string>('all');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/v1/expenses')
      .then(r => r.json())
      .then(b => setRows((b.data ?? []) as ExpenseRow[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // KPIs
  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }, []);
  const totalAll   = rows.reduce((s, r) => s + r.amountPaise, 0);
  const thisMonth  = rows.filter(r => new Date(r.createdAt).getTime() >= monthStart)
                         .reduce((s, r) => s + r.amountPaise, 0);
  const vendorCount   = new Set(rows.map(r => r.vendorName).filter(Boolean)).size;

  // Category breakdown (all rows, for sidebar)
  const catTotals = CATS_LIST.map(c => ({
    key:   c,
    label: EXP_LABEL[c],
    paise: rows.filter(r => r.category === c).reduce((s, r) => s + r.amountPaise, 0),
  })).filter(c => c.paise > 0).sort((a, b) => b.paise - a.paise);
  const topCat = catTotals[0];

  // Filtered rows
  const filtered = rows.filter(r => {
    if (catFilter !== 'all' && r.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.description ?? '').toLowerCase().includes(q) ||
             (r.vendorName  ?? '').toLowerCase().includes(q);
    }
    return true;
  });
  const filtTotal = filtered.reduce((s, r) => s + r.amountPaise, 0);

  return (
    <div className="space-y-5">

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-semibold tabular-nums">{filtered.length}</span> entries
          {' · '}
          <span className="font-semibold tabular-nums">{formatRupees(filtTotal)}</span> booked
        </p>
        <button className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold"
          style={{ background: 'var(--text-heading)', color: 'var(--surface-app)' }}>
          <Plus className="h-3.5 w-3.5" />Record Expense
        </button>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Expenses" value={formatRupees(totalAll)} icon={TrendingDown} accent="var(--danger)" />
        <KpiCard label="This Month"     value={formatRupees(thisMonth)} icon={Receipt} />
        <KpiCard label="Top Category"
          value={topCat?.label ?? '—'}
          sub={topCat ? formatRupees(topCat.paise) : undefined}
          icon={BarChart3} />
        <KpiCard label="Vendors" value={String(vendorCount)} sub="unique" icon={Building2} />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">

        {/* Main content */}
        <div className="flex-1 space-y-3 min-w-0">

          {/* Search + category dropdown */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search description or vendor..."
                className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-[13px] outline-none"
                style={{
                  background:  'var(--surface-card)',
                  borderColor: 'var(--border-subtle)',
                  color:       'var(--text-heading)',
                }}
              />
            </div>
            <select
              value={catFilter}
              onChange={e => setCat(e.target.value)}
              className="rounded-xl border px-3 py-2.5 text-[13px] font-medium outline-none"
              style={{
                background:  'var(--surface-card)',
                borderColor: 'var(--border-subtle)',
                color:       'var(--text-heading)',
              }}>
              <option value="all">All categories</option>
              {CATS_LIST.map(c => (
                <option key={c} value={c}>{EXP_LABEL[c]}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          {loading ? <TabSkeleton /> : filtered.length === 0 ? (
            <EmptyState icon={Receipt} title="No expenses found" sub="Logged expenses will appear here" />
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
              <table className="w-full border-collapse" style={{ fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '2px solid var(--border-subtle)' }}>
                    {['Date', 'Description', 'Category', 'Vendor', 'Amount', 'Receipt'].map((h, i) => (
                      <th key={h}
                        className={`px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap ${i >= 4 ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--text-tertiary)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => (
                    <tr key={r.id}
                      style={{
                        background:   'var(--surface-card)',
                        borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        cursor:       'pointer',
                      }}
                      onClick={() => window.location.href = `/expenses/${r.id}`}>

                      {/* Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap"
                        style={{ color: 'var(--text-secondary)' }}>
                        {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3.5 font-medium" style={{ color: 'var(--text-heading)', maxWidth: 220 }}>
                        <span className="line-clamp-1 block">{r.description ?? '—'}</span>
                      </td>

                      {/* Category with colored dot */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ background: CAT_DOT[r.category] ?? '#94a3b8' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {EXP_LABEL[r.category] ?? r.category}
                          </span>
                        </div>
                      </td>

                      {/* Vendor */}
                      <td className="px-4 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                        {r.vendorName ?? '—'}
                      </td>

                      {/* Amount — orange if unpaid */}
                      <td className="px-4 py-3.5 text-right">
                        <p className="font-bold tabular-nums"
                          style={{ color: r.paidAt ? 'var(--text-heading)' : '#f97316' }}>
                          {formatRupees(r.amountPaise)}
                        </p>
                        {r.gstPct > 0 && (
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            incl. {r.gstPct}% GST
                          </p>
                        )}
                      </td>

                      {/* Receipt */}
                      <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        {r.receiptUrl
                          ? <a href={r.receiptUrl} target="_blank" rel="noreferrer"
                              className="text-[12px] font-semibold"
                              style={{ color: 'var(--accent-base)' }}>
                              View
                            </a>
                          : <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Category sidebar */}
        {catTotals.length > 0 && (
          <div className="w-full lg:w-52 shrink-0">
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[13px] font-bold mb-4" style={{ color: 'var(--text-heading)' }}>
                By category
              </p>
              <div className="space-y-4">
                {catTotals.map(c => {
                  const pct = totalAll > 0 ? Math.round((c.paise / totalAll) * 100) : 0;
                  return (
                    <div key={c.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>{c.label}</p>
                        <p className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                          {fmtCompact(c.paise)}
                        </p>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: 'var(--surface-muted)' }}>
                        <div className="h-1 rounded-full"
                          style={{ width: `${pct}%`, background: CAT_DOT[c.key] ?? 'var(--accent-base)' }} />
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{pct}% of total</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GST Tab ──────────────────────────────────────────────────────────────────

const GST_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const GST_MON_SHORT   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDateLong(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${GST_MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function GstTab() {
  const [year,       setYear]   = useState(() => new Date().getFullYear());
  const [month,      setMonth]  = useState(() => new Date().getMonth() + 1);
  const [todayYear]             = useState(() => new Date().getFullYear());
  const [todayMonth]            = useState(() => new Date().getMonth() + 1);
  const [data,       setData]   = useState<GstData | null>(null);
  const [loading,    setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/finance/gst?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(b => setData(b.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month]);

  // Rolling 12 months starting from current
  const pills = useMemo(() => {
    const out: { year: number; month: number; label: string }[] = [];
    let y = todayYear, m = todayMonth;
    for (let i = 0; i < 12; i++) {
      out.push({ year: y, month: m, label: y === todayYear ? GST_MON_SHORT[m - 1] : `${GST_MON_SHORT[m - 1]} ${y}` });
      m--;
      if (m === 0) { m = 12; y--; }
    }
    return out;
  }, [todayYear, todayMonth]);

  const activePill = pills.find(p => p.month === month && p.year === year);
  const monthLabel = `${GST_MON_SHORT[month - 1]} ${year}`;
  const monthFull  = `${GST_MONTH_NAMES[month - 1]} ${year}`;

  // HSN summary — group hsnSacLinesJson from all output rows by (hsnSac, rate)
  const hsnSummary = useMemo(() => {
    if (!data?.outputRows) return [];
    const map = new Map<string, { hsnSac: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number }>();
    for (const row of data.outputRows) {
      const lines = Array.isArray(row.hsnSacLinesJson) ? (row.hsnSacLinesJson as GstHsnLine[]) : [];
      for (const line of lines) {
        const tax  = (line.cgstPaise ?? 0) + (line.sgstPaise ?? 0) + (line.igstPaise ?? 0);
        const rate = line.amountPaise > 0 ? Math.round(tax * 100 / line.amountPaise) : 0;
        const key  = `${line.hsnSac ?? '9987'}-${rate}`;
        const cur  = map.get(key);
        if (cur) {
          cur.taxable += line.amountPaise;
          cur.cgst    += line.cgstPaise ?? 0;
          cur.sgst    += line.sgstPaise ?? 0;
          cur.igst    += line.igstPaise ?? 0;
        } else {
          map.set(key, { hsnSac: line.hsnSac ?? '9987', rate, taxable: line.amountPaise, cgst: line.cgstPaise ?? 0, sgst: line.sgstPaise ?? 0, igst: line.igstPaise ?? 0 });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.rate - b.rate);
  }, [data]);

  // Output table totals
  const outTotals = useMemo(() => {
    if (!data?.outputRows) return { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    return data.outputRows.reduce((a, r) => ({
      taxable: a.taxable + r.subtotalPaise,
      cgst:    a.cgst + r.cgstPaise,
      sgst:    a.sgst + r.sgstPaise,
      igst:    a.igst + r.igstPaise,
      total:   a.total + r.cgstPaise + r.sgstPaise + r.igstPaise,
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
  }, [data]);

  // Input credit totals for KPI (taxable = amountPaise - gstAmountPaise)
  const inputTaxable = useMemo(() =>
    (data?.inputRows ?? []).reduce((s, r) => s + r.amountPaise - r.gstAmountPaise, 0),
  [data]);

  const TH = 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide';
  const TD = 'px-4 py-3 text-xs tabular-nums';

  return (
    <div className="space-y-5">

      {/* Month pills + export button */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {pills.map(p => (
          <button key={`${p.year}-${p.month}`}
            onClick={() => { setYear(p.year); setMonth(p.month); }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              background: p.month === month && p.year === year ? 'var(--accent-base)' : 'var(--surface-muted)',
              color:      p.month === month && p.year === year ? '#fff' : 'var(--text-secondary)',
            }}>
            {p.label}
          </button>
        ))}
        <button className="ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--surface-card)' }}>
          <Download className="h-3.5 w-3.5" />
          Export {activePill?.label ?? monthLabel} as PDF
        </button>
      </div>

      {loading ? <TabSkeleton /> : data ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--accent-base)' }}>Output Tax Collected</p>
              <p className="text-3xl font-black tabular-nums" style={{ color: 'var(--accent-base)' }}>{formatRupees(data.summary.outputPaise)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Taxable: {formatRupees(outTotals.taxable)}</p>
            </div>
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--accent-base)' }}>Input Credit (Expenses)</p>
              <p className="text-3xl font-black tabular-nums" style={{ color: 'var(--accent-base)' }}>{formatRupees(data.summary.inputPaise)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Taxable: {formatRupees(inputTaxable)}</p>
            </div>
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-card)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#b45309' }}>Net Payable — {monthFull}</p>
              <p className="text-3xl font-black tabular-nums" style={{ color: '#b45309' }}>{formatRupees(Math.abs(data.summary.netPaise))}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                CGST {formatRupees(data.summary.cgstPaise)} · SGST {formatRupees(data.summary.sgstPaise)} · IGST {formatRupees(data.summary.igstPaise)}
              </p>
            </div>
          </div>

          {/* OUTPUT TAX — INVOICES ISSUED */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 py-3" style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-base)' }}>Output Tax — Invoices Issued</p>
            </div>
            {data.outputRows.length === 0 ? (
              <p className="px-5 py-6 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>No invoices issued this month</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Invoice','Date','Client','Taxable','CGST','SGST','IGST','GST Total'].map(h => (
                      <th key={h} className={TH} style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {data.outputRows.map(r => (
                    <tr key={r.id} className="cursor-pointer hover:opacity-80" style={{ background: 'var(--surface-card)' }}
                      onClick={() => { window.location.href = `/invoices/${r.id}`; }}>
                      <td className="px-4 py-3 text-xs font-mono font-semibold" style={{ color: 'var(--accent-base)' }}>{r.invoiceNumber}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDateLong(r.issuedAt)}</td>
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{r.clientName ?? r.projectName ?? '—'}</td>
                      <td className={TD} style={{ color: 'var(--text-primary)' }}>{formatRupees(r.subtotalPaise)}</td>
                      <td className={TD} style={{ color: 'var(--text-secondary)' }}>{formatRupees(r.cgstPaise)}</td>
                      <td className={TD} style={{ color: 'var(--text-secondary)' }}>{formatRupees(r.sgstPaise)}</td>
                      <td className={TD} style={{ color: 'var(--text-secondary)' }}>{formatRupees(r.igstPaise)}</td>
                      <td className={`${TD} font-bold`} style={{ color: 'var(--accent-base)' }}>{formatRupees(r.cgstPaise + r.sgstPaise + r.igstPaise)}</td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ background: 'var(--surface-muted)', borderTop: '2px solid var(--border-subtle)' }}>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-heading)' }} colSpan={3}>Total</td>
                    <td className={`${TD} font-bold`} style={{ color: 'var(--text-heading)' }}>{formatRupees(outTotals.taxable)}</td>
                    <td className={`${TD} font-bold`} style={{ color: 'var(--text-heading)' }}>{formatRupees(outTotals.cgst)}</td>
                    <td className={`${TD} font-bold`} style={{ color: 'var(--text-heading)' }}>{formatRupees(outTotals.sgst)}</td>
                    <td className={`${TD} font-bold`} style={{ color: 'var(--text-heading)' }}>{formatRupees(outTotals.igst)}</td>
                    <td className={`${TD} font-bold`} style={{ color: 'var(--accent-base)' }}>{formatRupees(outTotals.total)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* HSN SUMMARY (FOR GSTR-1) */}
          {hsnSummary.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="px-5 py-3" style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-base)' }}>HSN Summary (for GSTR-1)</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['HSN / SAC','Rate','Taxable','CGST','SGST','IGST','Tax Total'].map(h => (
                      <th key={h} className={TH} style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {hsnSummary.map((h, i) => (
                    <tr key={i} style={{ background: 'var(--surface-card)' }}>
                      <td className="px-4 py-3 text-xs font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{h.hsnSac}</td>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--accent-base)' }}>{h.rate}%</td>
                      <td className={TD} style={{ color: 'var(--text-primary)' }}>{formatRupees(h.taxable)}</td>
                      <td className={TD} style={{ color: 'var(--text-secondary)' }}>{formatRupees(h.cgst)}</td>
                      <td className={TD} style={{ color: 'var(--text-secondary)' }}>{formatRupees(h.sgst)}</td>
                      <td className={TD} style={{ color: 'var(--text-secondary)' }}>{formatRupees(h.igst)}</td>
                      <td className={`${TD} font-bold`} style={{ color: 'var(--text-heading)' }}>{formatRupees(h.cgst + h.sgst + h.igst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* INPUT CREDIT — EXPENSES WITH GST */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 py-3" style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-base)' }}>Input Credit — Expenses with GST</p>
            </div>
            {data.inputRows.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>No GST-captured expenses for {monthFull}.</p>
                <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-tertiary)' }}>
                  Log expenses under the Expenses tab — expand &quot;Add GST details&quot; and enter the GST rate to capture input credit here.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Exp #','Description','Category','GST %','Taxable','GST Amount'].map(h => (
                      <th key={h} className={TH} style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {data.inputRows.map(r => (
                    <tr key={r.id} className="cursor-pointer hover:opacity-80" style={{ background: 'var(--surface-card)' }}
                      onClick={() => { window.location.href = `/expenses/${r.id}`; }}>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{r.expenseNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-primary)' }}>{r.description ?? '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{EXP_LABEL[r.category] ?? r.category}</td>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: 'var(--accent-base)' }}>{r.gstPct}%</td>
                      <td className={TD} style={{ color: 'var(--text-primary)' }}>{formatRupees(r.amountPaise - r.gstAmountPaise)}</td>
                      <td className={`${TD} font-bold`} style={{ color: 'var(--success-text)' }}>{formatRupees(r.gstAmountPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* GSTR-3B — NET PAYABLE THIS MONTH */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="px-5 py-3" style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-base)' }}>GSTR-3B — Net Payable This Month</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-6">
                {[
                  { label: 'CGST Payable', out: data.summary.cgstPaise, credit: 0 },
                  { label: 'SGST Payable', out: data.summary.sgstPaise, credit: 0 },
                  { label: 'IGST Payable', out: data.summary.igstPaise, credit: 0 },
                ].map(col => {
                  const net = col.out - col.credit;
                  return (
                    <div key={col.label} className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>{col.label}</p>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--accent-base)' }}>Output</span>
                        <span className="tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>{formatRupees(col.out)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--accent-base)' }}>Credit</span>
                        <span className="tabular-nums" style={{ color: 'var(--accent-base)' }}>−{formatRupees(col.credit)}</span>
                      </div>
                      <div className="flex justify-between text-xs pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <span className="font-bold" style={{ color: 'var(--text-heading)' }}>Net</span>
                        <span className="tabular-nums font-bold" style={{ color: 'var(--text-heading)' }}>{formatRupees(net)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total net payable to government</p>
                <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--text-heading)' }}>{formatRupees(Math.abs(data.summary.netPaise))}</p>
              </div>
            </div>
            <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                Estimate only. Carry-forward credits, RCM liability and advances from prior months are not reflected — confirm final figures with your CA.
              </p>
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon={BarChart3} title="No data for this period" sub="Select a different month" />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const tab          = (searchParams.get('tab') ?? 'overview') as Tab;

  const [overview, setOverview]   = useState<OverviewData | null>(null);
  const [ovLoading, setOvL]       = useState(true);
  const [globalDrawer, setGlobal] = useState(false);
  const [tallyOpen, setTallyOpen] = useState(false);
  const tallyRef = useRef<HTMLDivElement>(null);

  const fetchOverview = useCallback(() => {
    setOvL(true);
    fetch('/api/v1/finance/overview')
      .then(r => r.json())
      .then(b => setOverview(b.data ?? null))
      .catch(() => {})
      .finally(() => setOvL(false));
  }, []);

  // Initial load + 30-second auto-refresh
  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 30_000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  useEffect(() => {
    if (!tallyOpen) return;
    const h = (e: MouseEvent) => { if (!tallyRef.current?.contains(e.target as Node)) setTallyOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [tallyOpen]);

  function setTab(t: Tab) { router.push(`/finance?tab=${t}`); }

  const activeTab = TABS.find(t => t.key === tab) ?? TABS[0];

  return (
    <div className="flex flex-col min-h-full" style={{ background: 'var(--surface-page)' }}>

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--accent-soft)' }}>
                <Wallet className="h-5 w-5" style={{ color: 'var(--accent-base)' }} />
              </div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-heading)' }}>Accounts</h1>
            </div>
            <p className="text-xs mt-1 ml-11" style={{ color: 'var(--text-tertiary)' }}>
              {activeTab.label} — every rupee in and out, at a glance
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tally export */}
            <div ref={tallyRef} className="relative">
              <button onClick={() => setTallyOpen(o => !o)}
                className="flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--surface-card)' }}>
                <FileSpreadsheet className="h-4 w-4" />
                Export
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {tallyOpen && (
                <div className="absolute right-0 top-11 z-30 min-w-[180px] rounded-xl border py-1 shadow-xl"
                  style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
                  <Link href="/api/v1/accounts/tally-export?format=xml" target="_blank"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:opacity-70"
                    style={{ color: 'var(--text-primary)' }}>
                    <Download className="h-3.5 w-3.5" /> Tally XML
                  </Link>
                  <Link href="/api/v1/accounts/tally-export?format=csv" target="_blank"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:opacity-70"
                    style={{ color: 'var(--text-primary)' }}>
                    <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                  </Link>
                </div>
              )}
            </div>

            <button onClick={() => setGlobal(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-base)', color: '#fff' }}>
              <Plus className="h-4 w-4" /> Record payment
            </button>
          </div>
        </div>

        {/* ── Tab bar (underline style) ──────────────────────────── */}
        <div className="flex gap-0 overflow-x-auto" style={{ borderBottom: '2px solid var(--border-subtle)' }}>
          {TABS.map(t => {
            const Icon   = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="relative flex items-center gap-2 px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors"
                style={{ color: active ? 'var(--accent-base)' : 'var(--text-secondary)' }}>
                <Icon className="h-4 w-4" />
                {t.label}
                {active && (
                  <span className="absolute bottom-[-2px] left-0 right-0 h-0.5 rounded-full"
                    style={{ background: 'var(--accent-base)' }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-6">
        {tab === 'overview'   && <OverviewTab data={ovLoading ? null : overview} onRecordPayment={() => setGlobal(true)} />}
        {tab === 'to-collect' && <ToCollectTab onRefresh={() => { fetchOverview(); }} />}
        {tab === 'received'   && <ReceivedTab  onOpen={() => setGlobal(true)} />}
        {tab === 'to-pay'     && <ToPayTab />}
        {tab === 'expenses'   && <ExpensesTab />}
        {tab === 'gst'        && <GstTab />}
      </div>

      {/* Global record-payment drawer */}
      <RecordPaymentDrawer
        open={globalDrawer}
        onClose={() => setGlobal(false)}
        onSuccess={() => { setGlobal(false); fetchOverview(); }}
      />
    </div>
  );
}
