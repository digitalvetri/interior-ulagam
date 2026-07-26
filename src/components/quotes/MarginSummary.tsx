import { formatRupees } from '@/lib/utils';
import { QuoteLine } from '@/types/quotes';

interface MarginSummaryProps {
  lines: QuoteLine[];
  subtotalPaise: number;
  gstPaise: number;
  totalPaise: number;
}

export function MarginSummary({
  lines,
  subtotalPaise,
  gstPaise,
  totalPaise,
}: MarginSummaryProps) {
  const totalMarginPaise = lines.reduce((sum, l) => sum + l.marginPaise, 0);
  const marginPct =
    subtotalPaise > 0
      ? ((totalMarginPaise / subtotalPaise) * 100).toFixed(1)
      : '0.0';
  const marginPctNum = Number(marginPct);

  const marginPctColor =
    marginPctNum >= 20
      ? 'var(--text-accent)'
      : marginPctNum >= 10
        ? 'var(--text-gold)'
        : '#DC2626';

  return (
    <div className="premium-card p-4">
      <h3 className="section-title mb-3">
        Quote Summary
      </h3>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt style={{ color: 'var(--text-secondary)' }}>
            Total items
          </dt>
          <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {lines.length}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt style={{ color: 'var(--text-secondary)' }}>Subtotal</dt>
          <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {formatRupees(subtotalPaise)}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt style={{ color: 'var(--text-secondary)' }}>GST (18%)</dt>
          <dd className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {formatRupees(gstPaise)}
          </dd>
        </div>

        <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <dt className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>
            Total
          </dt>
          <dd className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>
            {formatRupees(totalPaise)}
          </dd>
        </div>

        <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <dt style={{ color: 'var(--text-secondary)' }}>Total Margin</dt>
          <dd
            className="font-medium"
            style={{ color: totalMarginPaise >= 0 ? 'var(--text-accent)' : '#DC2626' }}
          >
            {formatRupees(totalMarginPaise)}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt style={{ color: 'var(--text-secondary)' }}>Margin %</dt>
          <dd className="font-semibold" style={{ color: marginPctColor }}>
            {marginPct}%
          </dd>
        </div>
      </dl>
    </div>
  );
}
