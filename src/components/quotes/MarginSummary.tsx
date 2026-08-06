import { IndianRupee, TrendingUp } from 'lucide-react';
import { formatRupees } from '@/lib/utils';
import { QuoteLine } from '@/types/quotes';

interface MarginSummaryProps {
  lines: QuoteLine[];
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
}

export function MarginSummary({ lines, subtotalPaise, gstPaise, totalPaise }: MarginSummaryProps) {
  const totalMarginPaise = lines.reduce((sum, l) => sum + l.marginPaise, 0);
  const marginPct        = subtotalPaise > 0 ? (totalMarginPaise / subtotalPaise) * 100 : 0;
  const marginPctStr     = marginPct.toFixed(1);

  const marginColor =
    marginPct >= 20 ? 'var(--success)' :
    marginPct >= 10 ? 'var(--warning)' :
    'var(--danger)';

  const marginBarColor =
    marginPct >= 20 ? 'var(--success)' :
    marginPct >= 10 ? 'var(--warning)' :
    'var(--danger)';

  const barWidth = Math.min(100, Math.max(0, marginPct));

  return (
    <div className="space-y-4">

      {/* ── Totals ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-soft)' }}>
            <IndianRupee className="h-4 w-4" style={{ color: 'var(--accent-text)' }} />
          </div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Quote Summary</h3>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt style={{ color: 'var(--text-secondary)' }}>Items</dt>
            <dd className="font-medium" style={{ color: 'var(--text-heading)' }}>{lines.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: 'var(--text-secondary)' }}>Subtotal</dt>
            <dd className="font-medium" style={{ color: 'var(--text-heading)' }}>{formatRupees(subtotalPaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: 'var(--text-secondary)' }}>GST (18%)</dt>
            <dd className="font-medium" style={{ color: 'var(--text-heading)' }}>{formatRupees(gstPaise)}</dd>
          </div>
          <div className="flex justify-between pt-3" style={{ borderTop: '2px solid var(--border-subtle)' }}>
            <dt className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>Total</dt>
            <dd className="text-base font-bold" style={{ color: 'var(--accent-base)' }}>{formatRupees(totalPaise)}</dd>
          </div>
        </dl>
      </div>

      {/* ── Margin health ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ background: marginPct >= 20 ? 'var(--success-soft)' : marginPct >= 10 ? 'var(--warning-soft)' : 'var(--danger-soft)' }}>
            <TrendingUp className="h-4 w-4" style={{ color: marginColor }} />
          </div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Margin Health</h3>
        </div>

        <div className="mb-4">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold" style={{ color: marginColor }}>{marginPctStr}%</span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>margin</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${barWidth}%`, background: marginBarColor }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px]" style={{ color: '#C4BCAF' }}>0%</span>
            <span className="text-[10px]" style={{ color: '#C4BCAF' }}>10%</span>
            <span className="text-[10px]" style={{ color: '#C4BCAF' }}>20%+</span>
          </div>
        </div>

        <div className="flex justify-between text-sm pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Total Margin</span>
          <span className="font-semibold" style={{ color: totalMarginPaise >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {formatRupees(totalMarginPaise)}
          </span>
        </div>
      </div>
    </div>
  );
}
