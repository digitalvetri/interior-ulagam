import * as XLSX from 'xlsx';
import type { CivilLineKind, ParsedCivilJob, ParsedCivilLine, ParsedCivilWorkbook } from '@/types/civil';
import { rupeesToPaise, sumLines } from '@/lib/civil/totals';

// Reads the office's existing Excel job register. Runs in the browser: the file
// never reaches the server, only the validated JSON that comes out of it.
//
// Layout (one job = a block of rows):
//   S,NO | DATE | STORE NAME | COMPLAINTS | MATRIAL / LABOUR | TOTAL | REMARK | BILLING | BILLING DATE | MANNAGER
// S.NO, DATE, STORE and MANAGER are merged down the block. The heading sits in
// the amount column as text; lines are rows with a description AND an amount.

type Cell = string | number | boolean | null;
type ColumnKey = 'sno' | 'date' | 'store' | 'desc' | 'amount' | 'kind' | 'total' | 'remark' | 'billNo' | 'billDate' | 'manager';

/** Header text, with spaces and punctuation stripped, → column. Order matters: BILLINGDATE before BILLING. */
const HEADER_PATTERNS: [ColumnKey, RegExp][] = [
  ['sno', /^(S|SL)NO/],
  ['billDate', /^BILL(ING)?DATE/],
  ['date', /^DATE/],
  ['store', /STORE|BRANCH/],
  ['desc', /COMPLAINT|DESCRIPTION|PARTICULAR/],
  ['amount', /MAT|LABOU?R|AMOUNT/],
  ['kind', /^TYPE$/],
  ['total', /^TOTA/],
  ['remark', /REMARK/],
  ['billNo', /^BILL/],
  ['manager', /MAN+AGE/],
];

/** Columns whose value is shared by every row of a job, so a merge must be expanded. */
const BLOCK_COLUMNS: ColumnKey[] = ['sno', 'date', 'store', 'manager', 'billNo', 'billDate'];

const LABOUR_WORDS = /\b(LABOU?RS?|SALARY|WELDERS?|WAGES?|MASONS?|HELPERS?|COOLIE)\b/i;

function norm(v: Cell): string {
  return String(v ?? '').toUpperCase().replace(/[^A-Z]/g, '');
}

function text(v: Cell): string {
  return v === null || v === undefined || typeof v === 'boolean' ? '' : String(v).trim();
}

/** An explicit TYPE cell (our own export writes one) wins; otherwise guess from the wording. */
export function lineKind(description: string, explicit: Cell = null): CivilLineKind {
  const t = norm(explicit);
  if (t === 'LABOUR' || t === 'LABOR') return 'labour';
  if (t === 'MATERIAL') return 'material';
  return LABOUR_WORDS.test(description) ? 'labour' : 'material';
}

function isoParts(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Excel serial number or a dd-mm-yyyy / dd/mm/yy string → yyyy-mm-dd. Day always comes first. */
export function toIsoDate(v: Cell): string | null {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const p = XLSX.SSF.parse_date_code(v);
    return p ? isoParts(p.y, p.m, p.d) : null;
  }
  const m = text(v).match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return isoParts(year, Number(m[2]), Number(m[1]));
}

function findHeader(grid: Cell[][]): { row: number; cols: Partial<Record<ColumnKey, number>> } | null {
  for (let r = 0; r < Math.min(grid.length, 50); r++) {
    const cols: Partial<Record<ColumnKey, number>> = {};
    grid[r].forEach((cell, c) => {
      const h = norm(cell);
      if (!h) return;
      const hit = HEADER_PATTERNS.find(([key, re]) => cols[key] === undefined && re.test(h));
      if (hit) cols[hit[0]] = c;
    });
    if (cols.sno !== undefined && cols.store !== undefined && cols.amount !== undefined) return { row: r, cols };
  }
  return null;
}

function toGrid(ws: XLSX.WorkSheet): { grid: Cell[][]; merges: XLSX.Range[]; origin: XLSX.CellAddress } {
  const grid = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
  const origin = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s : { r: 0, c: 0 };
  return { grid, merges: ws['!merges'] ?? [], origin };
}

/** Copy each merged range's top-left value into every cell of the range — block columns only. */
function expandMerges(grid: Cell[][], merges: XLSX.Range[], origin: XLSX.CellAddress, columns: Set<number>) {
  for (const m of merges) {
    const r0 = m.s.r - origin.r;
    const c0 = m.s.c - origin.c;
    const value = grid[r0]?.[c0] ?? null;
    for (let r = r0; r <= m.e.r - origin.r; r++) {
      for (let c = c0; c <= m.e.c - origin.c; c++) {
        if (!columns.has(c) || !grid[r]) continue;
        grid[r][c] = value;
      }
    }
  }
}

interface Draft {
  jobNo: number;
  rows: Cell[][];
}

function buildJob(d: Draft, col: Partial<Record<ColumnKey, number>>): ParsedCivilJob {
  const at = (row: Cell[], key: ColumnKey): Cell => (col[key] === undefined ? null : row[col[key]!] ?? null);
  const first = (key: ColumnKey): Cell => d.rows.map(r => at(r, key)).find(v => text(v) !== '') ?? null;

  let heading = '';
  const lines: ParsedCivilLine[] = [];
  const notes: string[] = [];
  let orphan: string | null = null; // description whose amount sits on the following row
  let statedTotalPaise: number | null = null;
  // Our own download puts the heading in the description column of the job's
  // first row (no amount); the original sheet puts it in the amount column.
  const firstDesc = text(at(d.rows[0] ?? [], 'desc'));
  const headingCandidate = firstDesc && rupeesToPaise(at(d.rows[0] ?? [], 'amount')) === null ? firstDesc : null;

  for (const row of d.rows) {
    const desc = text(at(row, 'desc'));
    const rawAmount = at(row, 'amount');
    const amount = rupeesToPaise(rawAmount);

    if (amount === null && text(rawAmount)) {
      if (!heading) heading = text(rawAmount);
      else notes.push(text(rawAmount));
    }

    if (desc && amount !== null) {
      if (orphan) { notes.push(orphan); orphan = null; }
      lines.push({ description: desc, kind: lineKind(desc, at(row, 'kind')), amountPaise: amount });
    } else if (desc) {
      if (orphan) notes.push(orphan);
      orphan = desc;
    } else if (amount !== null) {
      const description = orphan ?? (heading || 'Work');
      orphan = null;
      lines.push({ description, kind: lineKind(description, at(row, 'kind')), amountPaise: amount });
    }

    const total = rupeesToPaise(at(row, 'total'));
    if (total !== null) statedTotalPaise = total;
    const remark = text(at(row, 'remark'));
    if (remark && !notes.includes(remark)) notes.push(remark);
  }
  if (orphan) notes.push(orphan);
  if (!heading && headingCandidate && notes.includes(headingCandidate)) {
    heading = headingCandidate;
    notes.splice(notes.indexOf(headingCandidate), 1);
  }

  const billNoRaw = text(first('billNo'));
  const sum = sumLines(lines).totalPaise;

  return {
    jobNo: d.jobNo,
    jobDate: toIsoDate(first('date')),
    storeName: text(first('store')),
    heading: heading || lines[0]?.description || 'GENERAL WORK',
    lines,
    remark: notes.length ? notes.join(' · ') : null,
    managerName: text(first('manager')) || null,
    billNo: billNoRaw || null,
    billDate: toIsoDate(first('billDate')),
    statedTotalPaise,
    mismatch: statedTotalPaise !== null && statedTotalPaise !== sum,
  };
}

function parseSheet(ws: XLSX.WorkSheet): ParsedCivilJob[] | null {
  const { grid, merges, origin } = toGrid(ws);
  const header = findHeader(grid);
  if (!header) return null;

  const { cols } = header;
  expandMerges(grid, merges, origin, new Set(BLOCK_COLUMNS.map(k => cols[k]).filter((c): c is number => c !== undefined)));

  const drafts: Draft[] = [];
  for (let r = header.row + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    // A grand-total line ends the register; it must not be read as part of the last job.
    if (row.some(cell => norm(cell).startsWith('GRANDTOTAL'))) break;
    const sno = row[cols.sno!];
    const no = typeof sno === 'number' ? Math.trunc(sno) : Number(text(sno));
    const current = drafts[drafts.length - 1];
    if (Number.isInteger(no) && no > 0 && no !== current?.jobNo) drafts.push({ jobNo: no, rows: [row] });
    else if (current) current.rows.push(row);
  }
  return drafts.map(d => buildJob(d, cols)).filter(j => j.storeName);
}

/**
 * Parse the job register. Every sheet with the job columns is listed in
 * `sheets` (the workbook also has e.g. a PENDING WORK tab); `sheetName` picks
 * one, otherwise the sheet with the most jobs wins.
 */
export function parseCivilWorkbook(data: ArrayBuffer, sheetName?: string): ParsedCivilWorkbook {
  const wb = XLSX.read(data, { type: 'array', cellDates: false });

  const found = wb.SheetNames
    .map(name => ({ name, jobs: parseSheet(wb.Sheets[name]) }))
    .filter((s): s is { name: string; jobs: ParsedCivilJob[] } => s.jobs !== null);
  if (!found.length) {
    throw new Error('No sheet has a header row with S.NO, STORE NAME and MATRIAL / LABOUR columns.');
  }

  const chosen = found.find(s => s.name === sheetName)
    ?? found.reduce((best, s) => (s.jobs.length > best.jobs.length ? s : best));
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
  return {
    sheetName: chosen.name,
    sheets: found.map(s => ({ name: s.name, jobCount: s.jobs.length })),
    jobs: chosen.jobs,
    storeNames: uniq(chosen.jobs.map(j => j.storeName)),
    managerNames: uniq(chosen.jobs.map(j => j.managerName)),
  };
}
