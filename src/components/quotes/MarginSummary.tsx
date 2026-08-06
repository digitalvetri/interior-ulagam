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
    marginPct >= 20 ? '#16A34A' :
    marginPct >= 10 ? '#D97706' :
    '#DC2626';

  const marginBarColor =
    marginPct >= 20 ? '#16A34A' :
    marginPct >= 10 ? '#F59E0B' :
    '#EF4444';

  const barWidth = Math.min(100, Math.max(0, marginPct));

  return (
    <div className="space-y-4">

      {/* ── Totals ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: '#F0EEE9' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ background: '#EFF6FF' }}>
            <IndianRupee className="h-4 w-4" style={{ color: '#1E40AF' }} />
          </div>
          <h3 className="text-sm font-bold" style={{ color: '#1C1916' }}>Quote Summary</h3>
        </div>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt style={{ color: '#6B6459' }}>Items</dt>
            <dd className="font-medium" style={{ color: '#1C1916' }}>{lines.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: '#6B6459' }}>Subtotal</dt>
            <dd className="font-medium" style={{ color: '#1C1916' }}>{formatRupees(subtotalPaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: '#6B6459' }}>GST (18%)</dt>
            <dd className="font-medium" style={{ color: '#1C1916' }}>{formatRupees(gstPaise)}</dd>
          </div>
          <div className="flex justify-between pt-3" style={{ borderTop: '2px solid #F0EEE9' }}>
            <dt className="text-base font-bold" style={{ color: '#1C1916' }}>Total</dt>
            <dd className="text-base font-bold" style={{ color: '#7C3AED' }}>{formatRupees(totalPaise)}</dd>
          </div>
        </dl>
      </div>

      {/* ── Margin health ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5" style={{ background: '#FFFFFF', borderColor: '#F0EEE9' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center"
            style={{ background: marginPct >= 20 ? '#F0FDF4' : marginPct >= 10 ? '#FFFBEB' : '#FEF2F2' }}>
            <TrendingUp className="h-4 w-4" style={{ color: marginColor }} />
          </div>
          <h3 className="text-sm font-bold" style={{ color: '#1C1916' }}>Margin Health</h3>
        </div>

        <div className="mb-4">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold" style={{ color: marginColor }}>{marginPctStr}%</span>
            <span className="text-xs" style={{ color: '#A79E8E' }}>margin</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F0EEE9' }}>
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

        <div className="flex justify-between text-sm pt-3" style={{ borderTop: '1px solid #F0EEE9' }}>
          <span style={{ color: '#6B6459' }}>Total Margin</span>
          <span className="font-semibold" style={{ color: totalMarginPaise >= 0 ? '#16A34A' : '#DC2626' }}>
            {formatRupees(totalMarginPaise)}
          </span>
        </div>
      </div>
    </div>
  );
}
