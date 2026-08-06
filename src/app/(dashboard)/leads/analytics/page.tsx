import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sql, count, sum, eq } from 'drizzle-orm';
import { leads } from '@/lib/db/schema';
import { ArrowLeft, TrendingUp, Users, Trophy, Star, Zap } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_ORDER = [
  'new', 'site_visit_scheduled', 'consultation_done',
  'proposal_sent', 'negotiation', 'won', 'lost',
] as const;

const STAGE_LABEL: Record<string, string> = {
  new:                  'New',
  site_visit_scheduled: 'Site Visit',
  consultation_done:    'Consultation',
  proposal_sent:        'Proposal Sent',
  negotiation:          'Negotiation',
  won:                  'Won',
  lost:                 'Lost',
};

const STAGE_COLOR: Record<string, string> = {
  new:                  '#6366f1',
  site_visit_scheduled: 'var(--accent-base)',
  consultation_done:    '#a855f7',
  proposal_sent:        '#d946ef',
  negotiation:          'var(--warning)',
  won:                  'var(--success)',
  lost:                 '#94a3b8',
};

const SOURCE_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  whatsapp:  'WhatsApp',
  referral:  'Referral',
  website:   'Website',
  walk_in:   'Walk-in',
  other:     'Other',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRupeesL(paise: number): string {
  if (paise === 0) return '₹0';
  if (paise >= 10_00_000) return '₹' + (paise / 10_00_000).toFixed(1) + 'L';
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <div style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderTop: `3px solid ${accent}`,
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {label}
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 10,
          background: `${accent}18`, color: accent,
        }}>
          {icon}
        </span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-heading)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '32px 0' }}>
        Not enough data yet — need at least 2 weeks of leads.
      </div>
    );
  }
  const W = 1200, H = 96, PX = 6, PY = 16;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: PX + (i / (data.length - 1)) * (W - 2 * PX),
    y: PY + (1 - v / max) * (H - 2 * PY),
    v,
  }));
  const lineStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaStr = `${pts[0].x.toFixed(1)},${H} ${lineStr} ${pts[pts.length - 1].x.toFixed(1)},${H}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="sgfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--violet-primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--violet-primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaStr} fill="url(#sgfill)" />
      <polyline
        points={lineStr}
        fill="none"
        stroke="var(--violet-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="var(--violet-primary)" strokeWidth="2" />
          {p.v > 0 && (
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="12" fill="var(--text-secondary)">
              {p.v}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LeadsAnalyticsPage() {
  const ctx = await requireAuth();
  if (ctx.role !== 'owner' && ctx.role !== 'accountant') {
    redirect('/leads');
  }

  const [rawSummary, funnelRows, rawSources, rawDesigners, rawWeekly] = await Promise.all([
    db.execute(sql`
      SELECT
        count(*)::int                                                            AS total,
        count(*) FILTER (WHERE stage NOT IN ('won', 'lost'))::int               AS active,
        count(*) FILTER (WHERE stage = 'won'
          AND created_at >= date_trunc('month', now()))::int                    AS won_this_month,
        round(avg(score))::int                                                   AS avg_score
      FROM leads
      WHERE tenant_id = ${ctx.tenantId}
    `),
    db
      .select({ stage: leads.stage, cnt: count(), valuePaise: sum(leads.projectValuePaise) })
      .from(leads)
      .where(eq(leads.tenantId, ctx.tenantId))
      .groupBy(leads.stage),
    db.execute(sql`
      SELECT
        source,
        count(*)::int                                                            AS total,
        count(*) FILTER (WHERE stage = 'won')::int                              AS won_count,
        coalesce(sum(project_value_paise), 0)                                   AS value_paise
      FROM leads
      WHERE tenant_id = ${ctx.tenantId}
      GROUP BY source
      ORDER BY total DESC
    `),
    db.execute(sql`
      SELECT
        u.full_name,
        count(*)::int                                                            AS total,
        count(*) FILTER (WHERE l.stage = 'won')::int                           AS won_count,
        coalesce(sum(l.project_value_paise), 0)                                AS value_paise
      FROM leads l
      JOIN users u ON l.owner_id = u.id
      WHERE l.tenant_id = ${ctx.tenantId}
      GROUP BY u.id, u.full_name
      ORDER BY total DESC
    `),
    db.execute(sql`
      SELECT
        date_trunc('week', created_at)::date  AS week,
        count(*)::int                          AS count
      FROM leads
      WHERE tenant_id = ${ctx.tenantId}
        AND created_at >= now() - interval '12 weeks'
      GROUP BY week
      ORDER BY week
    `),
  ]);

  type SummaryRow  = { total: unknown; active: unknown; won_this_month: unknown; avg_score: unknown };
  type SourceRow   = { source: string; total: unknown; won_count: unknown; value_paise: unknown };
  type DesignerRow = { full_name: string | null; total: unknown; won_count: unknown; value_paise: unknown };
  type WeekRow     = { week: unknown; count: unknown };

  const summaryRow   = (rawSummary   as unknown as SummaryRow[])[0]  ?? {};
  const sourceRows   = rawSources   as unknown as SourceRow[];
  const designerRows = rawDesigners as unknown as DesignerRow[];
  const weeklyRows   = rawWeekly    as unknown as WeekRow[];

  const total        = Number(summaryRow.total         ?? 0);
  const active       = Number(summaryRow.active        ?? 0);
  const wonThisMonth = Number(summaryRow.won_this_month ?? 0);
  const avgScore     = Number(summaryRow.avg_score     ?? 0);

  const funnelMap = Object.fromEntries(
    funnelRows.map(r => [r.stage, { count: r.cnt, valuePaise: Number(r.valuePaise ?? 0) }])
  );
  const maxFunnelCount = Math.max(...Object.values(funnelMap).map(v => v.count), 1);

  const totalPipelinePaise = funnelRows
    .filter(r => r.stage !== 'lost')
    .reduce((acc, r) => acc + Number(r.valuePaise ?? 0), 0);

  const weekCounts = weeklyRows.map(r => Number(r.count));

  const card: React.CSSProperties = {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 16,
    padding: '22px 26px',
  };

  const thStyle: React.CSSProperties = {
    paddingBottom: 10, fontSize: 11, fontWeight: 700,
    color: 'var(--text-secondary)', textTransform: 'uppercase',
    letterSpacing: '0.06em', borderBottom: '1px solid var(--border-subtle)',
    whiteSpace: 'nowrap',
  };

  const tdBase: React.CSSProperties = {
    paddingTop: 11, paddingBottom: 11,
    borderBottom: '1px solid var(--border-subtle)',
    verticalAlign: 'middle',
    fontSize: 13,
  };

  return (
    <main style={{ background: 'var(--surface-app)', minHeight: '100%', padding: '28px 32px' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <Link
          href="/leads"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 10,
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-card)',
            color: 'var(--text-secondary)',
            textDecoration: 'none', fontSize: 13, fontWeight: 500,
          }}
        >
          <ArrowLeft size={14} /> Leads
        </Link>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', margin: 0, letterSpacing: '-0.02em' }}>
            Lead Analytics
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            Pipeline intelligence · all time
          </p>
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <KpiCard
          label="Total Leads" value={String(total)}
          sub={`${active} active · ${total - active} decided`}
          icon={<Users size={15} />} accent="#6366f1"
        />
        <KpiCard
          label="Pipeline Value" value={fmtRupeesL(totalPipelinePaise)}
          sub={`${active} leads in pipeline`}
          icon={<TrendingUp size={15} />} accent="var(--accent-base)"
        />
        <KpiCard
          label="Won This Month" value={String(wonThisMonth)}
          sub="conversions this month"
          icon={<Trophy size={15} />} accent="var(--success)"
        />
        <KpiCard
          label="Avg Lead Score" value={avgScore > 0 ? `${avgScore}` : '—'}
          sub="out of 100 · quality index"
          icon={<Star size={15} />} accent="var(--warning)"
        />
      </div>

      {/* ── Stage funnel (full width) ────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>Stage Pipeline</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0' }}>
              Lead distribution across funnel stages
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} color="var(--violet-primary)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--violet-primary)' }}>
              {total} total leads
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STAGE_ORDER.map(stage => {
            const d = funnelMap[stage] ?? { count: 0, valuePaise: 0 };
            const pct = maxFunnelCount > 0 ? Math.round((d.count / maxFunnelCount) * 100) : 0;
            const ofTotal = total > 0 ? Math.round((d.count / total) * 100) : 0;
            const color = STAGE_COLOR[stage];
            return (
              // Same five columns at every width — a funnel row reads wrong if the
              // numbers detach from their bar. The fixed columns just get narrower
              // on a phone so the row still fits without scrolling.
              <div
                key={stage}
                className="grid items-center gap-2 sm:gap-4 grid-cols-[68px_1fr_28px_54px_46px] sm:grid-cols-[120px_1fr_48px_90px_80px] text-[11px] sm:text-[13px]"
              >
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {STAGE_LABEL[stage]}
                </span>
                <div style={{ height: 14, borderRadius: 99, background: 'var(--surface-muted)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    height: '100%', borderRadius: 99, background: color,
                    width: `${pct}%`, minWidth: d.count > 0 ? 8 : 0,
                    transition: 'width 0.4s ease',
                    opacity: 0.85,
                  }} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-heading)', textAlign: 'right' }}>
                  {d.count}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
                  {d.count > 0 ? `${ofTotal}% of total` : '—'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', fontWeight: d.valuePaise > 0 ? 600 : 400 }}>
                  {d.valuePaise > 0 ? fmtRupeesL(d.valuePaise) : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Source ROI + Designer Performance ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Source ROI */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 18px' }}>
            Source ROI
          </h2>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>Source</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Leads</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Won</th>
                <th style={{ ...thStyle, textAlign: 'left', paddingLeft: 12, width: 140 }}>Conv%</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                    No source data yet
                  </td>
                </tr>
              ) : sourceRows.map(r => {
                const tot = Number(r.total);
                const won = Number(r.won_count);
                const val = Number(r.value_paise);
                const pct = tot > 0 ? Math.round((won / tot) * 100) : 0;
                return (
                  <tr key={r.source}>
                    <td style={{ ...tdBase, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {SOURCE_LABEL[r.source] ?? r.source}
                    </td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {tot}
                    </td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                      {won}
                    </td>
                    <td style={{ ...tdBase, paddingLeft: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 5, borderRadius: 99, background: 'var(--surface-muted)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--success)', borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 30, textAlign: 'right', flexShrink: 0 }}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdBase, textAlign: 'right', color: 'var(--text-secondary)', fontWeight: val > 0 ? 600 : 400 }}>
                      {val > 0 ? fmtRupeesL(val) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
        </div>

        {/* Designer Performance */}
        <div style={card}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', margin: '0 0 18px' }}>
            Designer Performance
          </h2>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left', width: 28 }}>#</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Designer</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Leads</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Won</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {designerRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                    No assignments yet
                  </td>
                </tr>
              ) : designerRows.map((r, i) => {
                const val = Number(r.value_paise);
                const rank = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}`;
                return (
                  <tr key={r.full_name ?? i}>
                    <td style={{ ...tdBase, fontSize: 15 }}>{rank}</td>
                    <td style={{ ...tdBase, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {r.full_name ?? '—'}
                    </td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {Number(r.total)}
                    </td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                      {Number(r.won_count)}
                    </td>
                    <td style={{ ...tdBase, textAlign: 'right', color: 'var(--text-secondary)', fontWeight: val > 0 ? 600 : 400 }}>
                      {val > 0 ? fmtRupeesL(val) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
            </div>
        </div>
      </div>

      {/* ── Weekly volume chart (full width) ────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
              Weekly Lead Volume
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '3px 0 0' }}>
              Leads created per week · last 12 weeks
            </p>
          </div>
          {weekCounts.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.02em' }}>
                {weekCounts.reduce((a, b) => a + b, 0)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>total this period</div>
            </div>
          )}
        </div>
        <Sparkline data={weekCounts} />
        {weekCounts.length >= 2 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>12 weeks ago</span>
            <span>This week</span>
          </div>
        )}
      </div>

    </main>
  );
}
