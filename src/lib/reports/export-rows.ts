/**
 * Shapes report rows for an Excel export: every `…Paise` field becomes a
 * rupee number under a "… (₹)" header (Postgres bigint sums arrive as
 * strings, so they are coerced), other fields pass through unchanged.
 */

export const RUPEE_SUFFIX = ' (₹)';
/** Excel number format for rupee columns. */
export const RUPEE_FORMAT = '"₹"#,##0.00';

function humanise(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function toExportRows(rows: ReadonlyArray<Record<string, unknown>>): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === 'id' || key.endsWith('Id')) continue; // internal uuids mean nothing in a spreadsheet
      if (key.endsWith('Paise')) {
        const n = Number(value ?? 0);
        out[humanise(key.slice(0, -'Paise'.length)) + RUPEE_SUFFIX] = Number.isFinite(n) ? Math.round(n) / 100 : null;
      } else {
        out[humanise(key)] = value;
      }
    }
    return out;
  });
}
