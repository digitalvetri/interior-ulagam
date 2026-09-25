'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowUpRight, BarChart2, Building2,
  CheckCircle2, ChevronRight, Clock, HandCoins,
  IndianRupee, MessageCircle, TrendingDown, TrendingUp,
  Zap,
} from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { RecordPaymentDrawer } from '@/components/finance/RecordPaymentDrawer';

// ─── Types (mirror the API response) ─────────────────────────────────────────

interface KPIs {
  toCollectPaise: number; overduePaise: number;
  notYetInvoicedPaise: number; receivedPaise: number; toPayVendorPaise: number;
}
interface ChaseItem {
  milestoneId: string; projectId: string; projectName: string;
  clientName: string | null; label: string; balancePaise: number;
  daysLate: number; dueDate: string | null; promisedAt: string | null;
}
interface PayThisWeekItem {
  poId: string; poNumber: string; vendorName: string; projectName: string;
  balancePaise: number; status: string;
}
interface ChartMonth  { label: string; receivedPaise: number; expensesPaise: number }
interface CatItem     { category: string; amountPaise: number }
interface ModeItem    { mode: string; amountPaise: number; count: number }
interface AgingBuckets {
  notYetDuePaise: number; d0to30Paise: number; d31to60Paise: number; d60plusPaise: number;
}
export interface VendorPayableRow {
  id: string; vendor_name: string; project_name: string; po_number: string;
  total_amount_paise: number; paid_amount_paise: number; status: string;
}
export interface OverviewData {
  kpis: KPIs;
  chaseList: ChaseItem[];
  payThisWeek: PayThisWeekItem[];
  chartMonths: ChartMonth[];
  vendorPayables: VendorPayableRow[];
  expenseByCategory: CatItem[];
  paymentByMode: ModeItem[];
  agingBuckets: AgingBuckets;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = {
  petty_cash: 'Petty Cash', transport: 'Transport',
  labour: 'Labour', material: 'Material', other: 'Other',
};
const MODE_COLOR: Record<string, string> = {
  upi: '#4f46e5', cash: '#059669', bank: '#2563eb',
  cheque: '#b45309', card: '#be185d', razorpay: '#4338ca', other: '#6b7280',
};

// ─── Three.js Particle Canvas ─────────────────────────────────────────────────

function ThreeParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any;

    (async () => {
      try {
      const THREE = await import('three');
      const w = canvas.offsetWidth, h = canvas.offsetHeight;

      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
      camera.position.set(0, 0, 5);

      // Floating particle field
      const count = 180;
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 12;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
        velocities[i]         = 0.003 + Math.random() * 0.007;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.PointsMaterial({
        color: 0xffffff, size: 0.06, transparent: true, opacity: 0.35, sizeAttenuation: true,
      });
      const particles = new THREE.Points(geo, mat);
      scene.add(particles);

      // Subtle connecting lines (sparse)
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 });
      for (let i = 0; i < 25; i++) {
        const lGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, 0),
          new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, 0),
        ]);
        scene.add(new THREE.Line(lGeo, lineMat));
      }

      const pos = particles.geometry.attributes.position.array as Float32Array;

      const animate = () => {
        animId = requestAnimationFrame(animate);
        for (let i = 0; i < count; i++) {
          pos[i * 3 + 1] += velocities[i];
          if (pos[i * 3 + 1] > 3.5) {
            pos[i * 3 + 1] = -3.5;
            pos[i * 3]     = (Math.random() - 0.5) * 12;
          }
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.rotation.y += 0.0003;
        renderer.render(scene, camera);
      };
      animate();
      } catch (e) {
        // WebGL not available — canvas stays hidden
        console.warn('[ThreeParticleCanvas] WebGL init failed', e);
      }
    })();

    return () => {
      cancelAnimationFrame(animId);
      renderer?.dispose?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}

// ─── Count-up animation ───────────────────────────────────────────────────────

function CountUp({ target, duration = 900 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      setVal(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <>{formatRupees(val)}</>;
}

// ─── SVG Grouped Bar Chart ────────────────────────────────────────────────────

function GroupedBarChart({ months }: { months: ChartMonth[] }) {
  const [mounted, setMounted]             = useState(false);
  const [activeIdx, setActiveIdx]         = useState<number | null>(null);
  const [mouseX, setMouseX]               = useState(0); // px from container left
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, []);

  const PAD    = { top: 24, right: 16, bottom: 40, left: 56 };
  const W      = 560;
  const H      = 200;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top  - PAD.bottom;
  const maxVal = Math.max(...months.flatMap(m => [m.receivedPaise, m.expensesPaise]), 1);
  const TICKS  = 4;
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) => {
    const v = (maxVal / TICKS) * i;
    return { y: innerH - (v / maxVal) * innerH, label: formatRupees(Math.round(v)) };
  });
  const slotW = innerW / months.length;
  const barW  = Math.min(slotW * 0.32, 22);
  const gap   = Math.min(slotW * 0.06, 4);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const svgX = (relX / rect.width) * W;
    const idx  = Math.floor((svgX - PAD.left) / slotW);
    if (idx >= 0 && idx < months.length) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setActiveIdx(idx);
      setMouseX(relX);
      setTooltipVisible(true);
    }
  }

  function handleMouseLeave() {
    setTooltipVisible(false);
    hideTimer.current = setTimeout(() => setActiveIdx(null), 180);
  }

  const activeCxSvg = activeIdx !== null
    ? PAD.left + slotW * activeIdx + slotW / 2
    : 0;
  // crosshair X as % of viewBox width → usable as CSS left %
  const crosshairPct = (activeCxSvg / W) * 100;
  const m = activeIdx !== null ? months[activeIdx] : null;

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: `${H}px` }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        {/* Y-axis grid */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left} x2={W - PAD.right}
              y1={PAD.top + t.y} y2={PAD.top + t.y}
              stroke="var(--border-subtle)" strokeDasharray="3 3" strokeWidth={0.8}
            />
            <text x={PAD.left - 6} y={PAD.top + t.y + 4}
              textAnchor="end" fontSize={9} fill="var(--text-tertiary)">
              {i === 0 ? '0' : t.label}
            </text>
          </g>
        ))}

        {/* Bars */}
        {months.map((mo, i) => {
          const cx     = PAD.left + slotW * i + slotW / 2;
          const recH   = mounted && mo.receivedPaise > 0 ? (mo.receivedPaise / maxVal) * innerH : 0;
          const expH   = mounted && mo.expensesPaise > 0 ? (mo.expensesPaise / maxVal) * innerH : 0;
          const recY   = PAD.top + innerH - recH;
          const expY   = PAD.top + innerH - expH;
          const dimmed = activeIdx !== null && activeIdx !== i;

          return (
            <g key={i} style={{ cursor: 'default' }}>
              <rect x={cx - barW - gap / 2} y={recY} width={barW} height={recH} rx={3}
                fill="var(--accent-base)"
                opacity={dimmed ? 0.25 : 1}
                style={{ transition: 'opacity 0.15s ease, height 0.7s cubic-bezier(.22,.61,.36,1), y 0.7s cubic-bezier(.22,.61,.36,1)' }}
              />
              <rect x={cx + gap / 2} y={expY} width={barW} height={expH} rx={3}
                fill="var(--danger)"
                opacity={dimmed ? 0.18 : 0.75}
                style={{ transition: 'opacity 0.15s ease, height 0.7s cubic-bezier(.22,.61,.36,1), y 0.7s cubic-bezier(.22,.61,.36,1)' }}
              />
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={9.5}
                fill="var(--text-tertiary)"
                opacity={dimmed ? 0.35 : 1}
                style={{ transition: 'opacity 0.15s ease' }}>
                {mo.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Crosshair — CSS left % so it stays in SVG coordinate space */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: PAD.top, bottom: PAD.bottom,
          left: `${crosshairPct}%`,
          width: 1,
          background: 'var(--accent-base)',
          opacity: tooltipVisible ? 0.35 : 0,
          transition: 'left 0.08s ease, opacity 0.15s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip — HTML div, follows mouse with CSS left transition */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: `min(${mouseX + 14}px, calc(100% - 148px))`,
          opacity: tooltipVisible ? 1 : 0,
          transform: tooltipVisible ? 'translateY(0) scale(1)' : 'translateY(-5px) scale(0.97)',
          transition: 'opacity 0.15s ease, transform 0.15s ease, left 0.08s ease',
          pointerEvents: 'none',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '8px 12px',
          minWidth: 136,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 10,
        }}
      >
        {m && (
          <>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-heading)', marginBottom: 6 }}>
              {m.label}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-base)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>In</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-heading)' }}>{formatRupees(m.receivedPaise)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>Out</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-heading)' }}>{formatRupees(m.expensesPaise)}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flex: 1 }}>Net</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: m.receivedPaise >= m.expensesPaise ? 'var(--success-text)' : 'var(--danger-text)',
                }}>
                  {formatRupees(m.receivedPaise - m.expensesPaise)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Stacked Aging Bar ────────────────────────────────────────────────────────

function AgingBar({ buckets }: { buckets: AgingBuckets }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 200); return () => clearTimeout(t); }, []);

  const total = buckets.notYetDuePaise + buckets.d0to30Paise + buckets.d31to60Paise + buckets.d60plusPaise;
  if (total === 0) return (
    <p className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No outstanding invoices</p>
  );

  const segments = [
    { label: 'Not yet due', paise: buckets.notYetDuePaise, color: 'var(--success)',  dotColor: '#10b981' },
    { label: '0–30d late',  paise: buckets.d0to30Paise,    color: '#f59e0b',         dotColor: '#f59e0b' },
    { label: '31–60d late', paise: buckets.d31to60Paise,   color: '#f97316',         dotColor: '#f97316' },
    { label: '60+ late',    paise: buckets.d60plusPaise,    color: 'var(--danger)',   dotColor: '#ef4444' },
  ].filter(s => s.paise > 0);

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-7 w-full overflow-hidden rounded-xl">
        {segments.map(s => {
          const pct = mounted ? (s.paise / total) * 100 : 0;
          return (
            <div key={s.label}
              className="first:rounded-l-xl last:rounded-r-xl transition-all relative group"
              title={`${s.label}: ${formatRupees(s.paise)}`}
              style={{
                width: `${pct}%`,
                background: s.color,
                transition: 'width 0.9s cubic-bezier(.22,.61,.36,1)',
                minWidth: pct > 0 ? '4px' : '0',
              }}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.dotColor }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
              {formatRupees(s.paise)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────

function HBar({
  label, paise, total, color, sub,
}: { label: string; paise: number; total: number; color: string; sub?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 300); return () => clearTimeout(t); }, []);

  const pct = total > 0 ? Math.round((paise / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
            {formatRupees(paise)}
          </span>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{pct}%</span>
        </div>
      </div>
      {sub && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
      <div className="h-2 w-full rounded-full" style={{ background: 'var(--surface-muted)' }}>
        <div
          className="h-2 rounded-full"
          style={{
            width: mounted ? `${pct}%` : '0%',
            background: color,
            transition: 'width 0.8s cubic-bezier(.22,.61,.36,1)',
          }}
        />
      </div>
    </div>
  );
}

// ─── Chase card ───────────────────────────────────────────────────────────────

function ChaseCard({
  item, onGotPaid,
}: { item: ChaseItem; onGotPaid: (item: ChaseItem) => void }) {
  return (
    <div className="border-b last:border-b-0 px-5 py-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
            {item.clientName ?? item.projectName}
          </p>
          <p className="text-xs mt-0.5 flex flex-wrap items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
            {item.label}
            {item.daysLate > 0 && (
              <span className="font-bold" style={{ color: 'var(--danger)' }}>
                {item.daysLate}d late
              </span>
            )}
            {item.promisedAt && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                <Clock className="h-2.5 w-2.5" /> Promised
              </span>
            )}
          </p>
        </div>
        <p className="text-lg font-bold tabular-nums shrink-0" style={{ color: 'var(--text-heading)' }}>
          {formatRupees(item.balancePaise)}
        </p>
      </div>
      <div className="flex gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Hi, just following up on your payment of ${formatRupees(item.balancePaise)} for ${item.projectName}. Could you please confirm when we can expect it?`)}`}
          target="_blank" rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold border transition-colors"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <MessageCircle className="h-3.5 w-3.5 text-green-500" />
          WhatsApp
        </a>
        <button
          onClick={() => onGotPaid(item)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors"
          style={{ background: 'var(--accent-base)', color: '#fff' }}>
          <IndianRupee className="h-3.5 w-3.5" />
          Got paid
        </button>
        <button
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold border transition-colors"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
          <Clock className="h-3.5 w-3.5" />
          Promised
        </button>
      </div>
    </div>
  );
}

// ─── Main OverviewTab ─────────────────────────────────────────────────────────

export function OverviewTab({
  data, onRecordPayment,
}: { data: OverviewData | null; onRecordPayment: () => void }) {
  const [drawer, setDrawer] = useState<{ open: boolean; item?: ChaseItem }>({ open: false });

  if (!data) {
    // Skeleton
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-36 rounded-2xl" style={{ background: 'var(--surface-muted)' }} />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl" style={{ background: 'var(--surface-muted)' }} />)}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="h-64 rounded-2xl" style={{ background: 'var(--surface-muted)' }} />
          <div className="h-64 rounded-2xl" style={{ background: 'var(--surface-muted)' }} />
        </div>
        <div className="h-48 rounded-2xl" style={{ background: 'var(--surface-muted)' }} />
      </div>
    );
  }

  const { kpis, chaseList, payThisWeek, chartMonths, expenseByCategory, paymentByMode, agingBuckets } = data;

  const totalIn       = chartMonths.reduce((s, m) => s + m.receivedPaise, 0);
  const totalOut      = chartMonths.reduce((s, m) => s + m.expensesPaise, 0);
  const netPaise      = totalIn - totalOut;
  const totalModeAmt  = paymentByMode.reduce((s, m) => s + m.amountPaise, 0);
  const totalCatAmt   = expenseByCategory.reduce((s, c) => s + c.amountPaise, 0);

  return (
    <div className="space-y-5">

      {/* ── Hero: To Collect ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl px-7 py-7"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)', minHeight: '140px' }}>
        <ThreeParticleCanvas />
        <div className="relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] mb-2"
            style={{ color: 'rgba(255,255,255,0.55)' }}>
            To Collect
          </p>
          <p className="text-4xl font-black tracking-tight text-white leading-none">
            <CountUp target={kpis.toCollectPaise} duration={1000} />
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {chaseList.length} open milestones
            </span>
            {kpis.overduePaise > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                <AlertTriangle className="h-3 w-3" />
                {formatRupees(kpis.overduePaise)} overdue
              </span>
            )}
            <Link href="/finance?tab=to-collect"
              className="flex items-center gap-1 text-xs font-semibold ml-auto"
              style={{ color: 'rgba(255,255,255,0.7)' }}>
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Sub KPIs (came in / to pay / net) ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Came In (6m)', value: totalIn,
            icon: HandCoins, accent: '#10b981',
            sub: `${chartMonths.filter(m => m.receivedPaise > 0).length} months with income`,
          },
          {
            label: 'To Pay Vendors', value: kpis.toPayVendorPaise,
            icon: Building2, accent: '#f59e0b',
            sub: `${payThisWeek.length} outstanding`,
          },
          {
            label: netPaise >= 0 ? 'Net Surplus (6m)' : 'Net Loss (6m)',
            value: Math.abs(netPaise),
            icon: netPaise >= 0 ? TrendingUp : TrendingDown,
            accent: netPaise >= 0 ? '#10b981' : '#ef4444',
            sub: totalIn > 0 ? `${Math.round((netPaise / totalIn) * 100)}% margin` : '—',
          },
        ].map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border p-4 flex flex-col gap-1.5 overflow-hidden relative"
              style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
              <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: c.accent }} />
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider pl-2" style={{ color: 'var(--text-tertiary)' }}>
                  {c.label}
                </p>
                <div className="h-7 w-7 rounded-xl flex items-center justify-center"
                  style={{ background: `${c.accent}18` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: c.accent }} />
                </div>
              </div>
              <p className="text-xl font-black tabular-nums pl-2" style={{ color: c.accent }}>
                <CountUp target={c.value} duration={900} />
              </p>
              <p className="text-[11px] pl-2" style={{ color: 'var(--text-tertiary)' }}>{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ── Two-col: bar chart + aging ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

        {/* Money In vs Out — bar chart */}
        <div className="lg:col-span-3 rounded-2xl border p-5"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>
                Money in vs Money out
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {formatRupees(totalIn)} in · {formatRupees(totalOut)} out
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{ background: 'var(--accent-base)' }} />
                Revenue
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{ background: 'var(--danger)', opacity: 0.75 }} />
                Expenses
              </span>
            </div>
          </div>
          <GroupedBarChart months={chartMonths} />
          <p className="text-[10px] mt-3 text-center" style={{ color: 'var(--text-tertiary)' }}>
            Tap a month to see details ·{' '}
            <Link href="/finance?tab=received" className="hover:underline" style={{ color: 'var(--accent-base)' }}>
              View all →
            </Link>
          </p>
        </div>

        {/* How long they've owed */}
        <div className="lg:col-span-2 rounded-2xl border p-5"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="mb-4">
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>How long they&apos;ve owed</h3>
            <p className="text-xl font-black tabular-nums mt-1" style={{ color: 'var(--text-heading)' }}>
              <CountUp target={kpis.toCollectPaise} />
            </p>
          </div>
          <AgingBar buckets={agingBuckets} />
        </div>
      </div>

      {/* ── Chase these today ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center"
              style={{ background: '#fef3c7' }}>
              <Zap className="h-4 w-4" style={{ color: '#d97706' }} />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Chase these today</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{chaseList.length} overdue</p>
            </div>
          </div>
          <Link href="/finance?tab=to-collect"
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--accent-base)' }}>
            View all {chaseList.length} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {chaseList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CheckCircle2 className="h-8 w-8" style={{ color: 'var(--success)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--success-text)' }}>All caught up!</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No overdue receivables right now</p>
          </div>
        ) : (
          chaseList.slice(0, 5).map(item => (
            <ChaseCard key={item.milestoneId} item={item} onGotPaid={i => setDrawer({ open: true, item: i })} />
          ))
        )}
      </div>

      {/* ── Two-col: expense breakdown + payment modes ────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Where money goes */}
        <div className="rounded-2xl border p-5"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Where the money goes</h3>
              <p className="text-xl font-black tabular-nums mt-1" style={{ color: 'var(--text-heading)' }}>
                <CountUp target={totalCatAmt} />
              </p>
            </div>
            <Link href="/finance?tab=expenses"
              className="text-xs font-semibold" style={{ color: 'var(--accent-base)' }}>
              All expenses →
            </Link>
          </div>
          {expenseByCategory.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-tertiary)' }}>No expenses logged yet</p>
          ) : (
            <div className="space-y-4">
              {expenseByCategory.slice(0, 6).map(c => (
                <HBar
                  key={c.category}
                  label={CAT_LABEL[c.category] ?? c.category}
                  paise={c.amountPaise}
                  total={totalCatAmt}
                  color="var(--accent-base)"
                />
              ))}
            </div>
          )}
        </div>

        {/* How people pay you */}
        <div className="rounded-2xl border p-5"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>How people pay you</h3>
              <p className="text-xl font-black tabular-nums mt-1" style={{ color: 'var(--text-heading)' }}>
                <CountUp target={totalModeAmt} />
              </p>
            </div>
            <Link href="/finance?tab=received"
              className="text-xs font-semibold" style={{ color: 'var(--accent-base)' }}>
              All received →
            </Link>
          </div>
          {paymentByMode.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--text-tertiary)' }}>No payments recorded yet</p>
          ) : (
            <div className="space-y-4">
              {paymentByMode.slice(0, 6).map(m => (
                <HBar
                  key={m.mode}
                  label={m.mode.charAt(0).toUpperCase() + m.mode.slice(1)}
                  paise={m.amountPaise}
                  total={totalModeAmt}
                  color={MODE_COLOR[m.mode] ?? 'var(--accent-base)'}
                  sub={`${m.count} payment${m.count !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Pay vendors this week ─────────────────────────────────────────────── */}
      {payThisWeek.length > 0 && (
        <div className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="px-5 py-3.5 flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--warning-soft)' }}>
            <p className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--warning-text)' }}>
              <TrendingDown className="h-4 w-4" />
              Pay vendors — {payThisWeek.length} outstanding
            </p>
            <Link href="/finance?tab=to-pay"
              className="text-xs font-semibold" style={{ color: 'var(--warning-text)' }}>
              View all →
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {payThisWeek.map(po => (
              <div key={po.poId} className="flex items-center justify-between px-5 py-3.5 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{po.vendorName}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{po.poNumber} · {po.projectName}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--warning-text)' }}>
                    {formatRupees(po.balancePaise)}
                  </p>
                  <button onClick={onRecordPayment}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                    style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                    Pay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Got-paid drawer */}
      <RecordPaymentDrawer
        open={drawer.open}
        onClose={() => setDrawer({ open: false })}
        contextLabel={drawer.item
          ? `${drawer.item.clientName ?? drawer.item.projectName} — ${drawer.item.label}`
          : undefined}
        defaultAmountPaise={drawer.item?.balancePaise}
        defaultProjectId={drawer.item?.projectId}
        onSuccess={() => setDrawer({ open: false })}
      />
    </div>
  );
}
