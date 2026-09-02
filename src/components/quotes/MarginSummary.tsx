import { IndianRupee } from 'lucide-react';
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

  return (
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

      {/* Internal margin — owner-only metric, never shown in client preview */}
      {lines.length > 0 && (
        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px dashed var(--border-subtle)' }}>
          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            Internal margin
          </span>
          <span className="text-[11px] font-semibold tabular-nums"
            style={{ color: marginColor }}>
            {marginPctStr}% · {formatRupees(totalMarginPaise)}
          </span>
        </div>
      )}
    </div>
  );
}
