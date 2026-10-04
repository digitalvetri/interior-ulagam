import type { CivilLineKind } from '@/types/civil';

export interface LineTotals {
  materialPaise: number;
  labourPaise: number;
  totalPaise: number;
}

export function sumLines(lines: readonly { kind: CivilLineKind; amountPaise: number }[]): LineTotals {
  let materialPaise = 0;
  let labourPaise = 0;
  for (const l of lines) {
    if (l.kind === 'labour') labourPaise += l.amountPaise;
    else materialPaise += l.amountPaise;
  }
  return { materialPaise, labourPaise, totalPaise: materialPaise + labourPaise };
}

/**
 * Rupees as typed or read from Excel ("24,597", 850, "1,500.50") → integer paise.
 * Returns null for anything that is not a number, so a manager's name in an
 * amount column is never mistaken for ₹0.
 */
export function rupeesToPaise(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[,₹\s]/g, '').replace(/^rs\.?/i, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
