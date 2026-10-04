/** 2026-09-21 → 21-09-2026, the way the office writes dates. */
export function dmy(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "1,500" / "1500.5" typed in an amount box → paise; blank or junk → 0. */
export function inputToPaise(value: string): number {
  const n = Number(value.replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

/** Paise → the plain number shown inside an amount box (no ₹, no grouping). */
export function paiseToInput(paise: number): string {
  if (!paise) return '';
  const r = paise / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

/** Read `{ error }` from a failed API response. */
export async function apiError(res: Response, fallback = 'Something went wrong.'): Promise<string> {
  try {
    const j = (await res.json()) as { error?: unknown };
    return typeof j.error === 'string' ? j.error : fallback;
  } catch {
    return fallback;
  }
}
