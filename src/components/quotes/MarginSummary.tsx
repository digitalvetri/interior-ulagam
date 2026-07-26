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
      ? 'text-green-600 dark:text-green-400'
      : marginPctNum >= 10
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
        Quote Summary
      </h3>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">
            Total items
          </dt>
          <dd className="font-medium text-gray-700 dark:text-gray-300">
            {lines.length}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">Subtotal</dt>
          <dd className="font-medium text-gray-700 dark:text-gray-300">
            {formatRupees(subtotalPaise)}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">GST (18%)</dt>
          <dd className="font-medium text-gray-700 dark:text-gray-300">
            {formatRupees(gstPaise)}
          </dd>
        </div>

        <div className="flex justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
          <dt className="text-base font-semibold text-gray-900 dark:text-white">
            Total
          </dt>
          <dd className="text-base font-bold text-gray-900 dark:text-white">
            {formatRupees(totalPaise)}
          </dd>
        </div>

        <div className="flex justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
          <dt className="text-gray-500 dark:text-gray-400">Total Margin</dt>
          <dd
            className={`font-medium ${
              totalMarginPaise >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatRupees(totalMarginPaise)}
          </dd>
        </div>

        <div className="flex justify-between">
          <dt className="text-gray-500 dark:text-gray-400">Margin %</dt>
          <dd className={`font-semibold ${marginPctColor}`}>
            {marginPct}%
          </dd>
        </div>
      </dl>
    </div>
  );
}
