import ExcelJS from 'exceljs';
import type { CivilJobWithLines } from '@/lib/civil/server';
import { STATUS_LABEL } from '@/lib/civil/status';
import { sumLines } from '@/lib/civil/totals';

// Styled .xlsx work statement — the Excel twin of the PDF statement. Colours
// follow the app (forest green, cream). The table header uses names the import
// parser recognises, so a downloaded file can be imported back.

const GREEN = 'FF1F4A36';
const CREAM = 'FFF1EDE4';
const CREAM_LIGHT = 'FFFAF8F3';
const LINE = 'FFD9D1C2';
const GREY = 'FF5E625B';
const WHITE = 'FFFFFFFF';

const STATUS_FILL: Record<string, { bg: string; fg: string }> = {
  done: { bg: 'FFE0F2FE', fg: 'FF0369A1' },
  billed: { bg: 'FFEEF2FF', fg: 'FF4338CA' },
  paid: { bg: 'FFE4F1E9', fg: 'FF17684A' },
};

const RUPEES = '"₹"#,##0;-"₹"#,##0;"–"';

// Table columns, in order. `key` names are only used here.
const COLUMNS = [
  { key: 'no', header: 'S.NO', width: 7 },
  { key: 'date', header: 'DATE', width: 12 },
  { key: 'branch', header: 'BRANCH', width: 18 },
  { key: 'desc', header: 'WORK / DESCRIPTION', width: 46 },
  { key: 'type', header: 'TYPE', width: 11 },
  { key: 'amount', header: 'AMOUNT', width: 13 },
  { key: 'total', header: 'TOTAL', width: 14 },
  { key: 'status', header: 'STATUS', width: 10 },
  { key: 'billNo', header: 'BILL NO', width: 12 },
  { key: 'billDate', header: 'BILL DATE', width: 12 },
  { key: 'manager', header: 'MANAGER', width: 14 },
  { key: 'remark', header: 'REMARK', width: 28 },
] as const;
const COL = Object.fromEntries(COLUMNS.map((c, i) => [c.key, i + 1])) as Record<(typeof COLUMNS)[number]['key'], number>;
const LAST = COLUMNS.length;

export interface ExcelStatementInput {
  title: string;      // "Dmart · Thudiyalur"
  period: string;     // "Oct 2026"
  studioName: string;
  jobs: CivilJobWithLines[];
}

function dmy(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

const thin = (argb = LINE): Partial<ExcelJS.Border> => ({ style: 'thin', color: { argb } });
const box = (argb = LINE): Partial<ExcelJS.Borders> => ({ top: thin(argb), left: thin(argb), bottom: thin(argb), right: thin(argb) });
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function styleRow(row: ExcelJS.Row, style: { fill?: string; bold?: boolean; color?: string; size?: number; border?: string }) {
  for (let c = 1; c <= LAST; c++) {
    const cell = row.getCell(c);
    if (style.fill) cell.fill = fill(style.fill);
    cell.font = { name: 'Calibri', size: style.size ?? 10, bold: style.bold, color: { argb: style.color ?? 'FF262924' } };
    cell.border = box(style.border);
    cell.alignment = { vertical: 'middle', wrapText: c === COL.desc || c === COL.remark };
  }
}

export async function buildCivilExcel(input: ExcelStatementInput): Promise<Buffer> {
  const { jobs } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = input.studioName;
  wb.created = new Date();

  const ws = wb.addWorksheet('Work statement', {
    views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      printTitlesRow: '7:7',
    },
    headerFooter: { oddFooter: `&L${input.studioName}&CPage &P of &N&R${input.period}` },
  });
  ws.columns = COLUMNS.map(c => ({ width: c.width }));

  // ── Title band ─────────────────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, LAST);
  const title = ws.getCell(1, 1);
  title.value = `${input.title.toUpperCase()}  —  WORK STATEMENT`;
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: WHITE } };
  title.fill = fill(GREEN);
  title.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, LAST);
  const sub = ws.getCell(2, 1);
  sub.value = `Period: ${input.period}     ·     ${jobs.length} job${jobs.length !== 1 ? 's' : ''}     ·     Prepared by ${input.studioName} on ${dmy(new Date().toISOString())}`;
  sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: GREY } };
  sub.fill = fill(CREAM_LIGHT);
  sub.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(2).height = 20;

  // ── Summary boxes (rows 4–5) ───────────────────────────────────────────────
  const totals = sumLines(jobs.flatMap(j => j.lines));
  const cards: { label: string; value: number; money: boolean; from: number; to: number; accent?: boolean }[] = [
    // Spans chosen so the four boxes come out roughly the same width.
    { label: 'JOBS', value: jobs.length, money: false, from: COL.no, to: COL.branch },
    { label: 'MATERIAL', value: totals.materialPaise / 100, money: true, from: COL.desc, to: COL.desc },
    { label: 'LABOUR', value: totals.labourPaise / 100, money: true, from: COL.type, to: COL.total },
    { label: 'GRAND TOTAL', value: totals.totalPaise / 100, money: true, from: COL.status, to: COL.manager, accent: true },
  ];
  for (const card of cards) {
    ws.mergeCells(4, card.from, 4, card.to);
    ws.mergeCells(5, card.from, 5, card.to);
    const l = ws.getCell(4, card.from);
    const v = ws.getCell(5, card.from);
    l.value = card.label;
    l.font = { name: 'Calibri', size: 8, bold: true, color: { argb: card.accent ? WHITE : GREY } };
    v.value = card.value;
    v.numFmt = card.money ? RUPEES : '0';
    v.font = { name: 'Calibri', size: 15, bold: true, color: { argb: card.accent ? WHITE : 'FF1A1D1A' } };
    for (const cell of [l, v]) {
      cell.fill = fill(card.accent ? GREEN : CREAM);
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }
    for (let c = card.from; c <= card.to; c++) {
      ws.getCell(4, c).border = { top: thin(GREEN), left: c === card.from ? thin(GREEN) : undefined, right: c === card.to ? thin(GREEN) : undefined };
      ws.getCell(5, c).border = { bottom: thin(GREEN), left: c === card.from ? thin(GREEN) : undefined, right: c === card.to ? thin(GREEN) : undefined };
    }
  }
  ws.getRow(4).height = 16;
  ws.getRow(5).height = 26;

  // ── Table header (row 7) ───────────────────────────────────────────────────
  const head = ws.getRow(7);
  COLUMNS.forEach((c, i) => { head.getCell(i + 1).value = c.header; });
  styleRow(head, { fill: GREEN, bold: true, color: WHITE, border: GREEN });
  head.eachCell(cell => { cell.alignment = { vertical: 'middle', horizontal: 'center' }; });
  head.height = 22;

  // ── Jobs ───────────────────────────────────────────────────────────────────
  let r = 8;
  for (const j of jobs) {
    const job = ws.getRow(r++);
    job.getCell(COL.no).value = j.jobNo;
    job.getCell(COL.date).value = dmy(j.jobDate);
    job.getCell(COL.branch).value = j.branchName;
    // The heading sits in the AMOUNT column's row as text in the original sheet;
    // here it reads naturally in the description column (the importer accepts both).
    job.getCell(COL.desc).value = j.heading.toUpperCase();
    job.getCell(COL.total).value = j.totalPaise / 100;
    job.getCell(COL.status).value = STATUS_LABEL[j.status];
    job.getCell(COL.billNo).value = j.billNo ?? '';
    job.getCell(COL.billDate).value = dmy(j.billDate);
    job.getCell(COL.manager).value = j.managerName ?? '';
    job.getCell(COL.remark).value = j.remark ?? '';
    styleRow(job, { fill: CREAM, bold: true });
    // A firm green rule above each job makes every job read as its own box.
    job.eachCell({ includeEmpty: true }, cell => { cell.border = { ...cell.border, top: { style: 'medium', color: { argb: GREEN } } }; });
    job.getCell(COL.total).numFmt = RUPEES;
    job.getCell(COL.no).alignment = { vertical: 'middle', horizontal: 'center' };
    job.getCell(COL.date).alignment = { vertical: 'middle', horizontal: 'center' };
    job.getCell(COL.remark).font = { name: 'Calibri', size: 9, italic: true, color: { argb: GREY } };
    const st = STATUS_FILL[j.status];
    const stCell = job.getCell(COL.status);
    stCell.fill = fill(st.bg);
    stCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: st.fg } };
    stCell.alignment = { vertical: 'middle', horizontal: 'center' };
    job.height = 20;

    for (const l of j.lines) {
      const row = ws.getRow(r++);
      row.getCell(COL.desc).value = l.description;
      row.getCell(COL.type).value = l.kind === 'labour' ? 'LABOUR' : 'MATERIAL';
      row.getCell(COL.amount).value = l.amountPaise / 100;
      styleRow(row, { fill: WHITE });
      row.getCell(COL.desc).alignment = { vertical: 'middle', indent: 2, wrapText: true };
      row.getCell(COL.amount).numFmt = RUPEES;
      const type = row.getCell(COL.type);
      type.alignment = { vertical: 'middle', horizontal: 'center' };
      type.font = { name: 'Calibri', size: 8, bold: true, color: { argb: l.kind === 'labour' ? 'FF8A650F' : GREEN } };
    }
  }

  if (!jobs.length) {
    ws.mergeCells(r, 1, r, LAST);
    const empty = ws.getCell(r, 1);
    empty.value = 'No jobs in this period.';
    empty.font = { name: 'Calibri', size: 11, italic: true, color: { argb: GREY } };
    empty.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = 28;
    r++;
  }

  // ── Grand total ────────────────────────────────────────────────────────────
  const gt = ws.getRow(r + 1);
  gt.getCell(COL.desc).value = `GRAND TOTAL  ·  ${jobs.length} job${jobs.length !== 1 ? 's' : ''}`;
  gt.getCell(COL.total).value = totals.totalPaise / 100;
  styleRow(gt, { fill: GREEN, bold: true, color: WHITE, size: 12, border: GREEN });
  gt.getCell(COL.total).numFmt = RUPEES;
  gt.getCell(COL.desc).alignment = { vertical: 'middle', horizontal: 'right' };
  gt.height = 24;

  const split = ws.getRow(r + 2);
  split.getCell(COL.desc).value = 'Material';
  split.getCell(COL.total).value = totals.materialPaise / 100;
  const split2 = ws.getRow(r + 3);
  split2.getCell(COL.desc).value = 'Labour';
  split2.getCell(COL.total).value = totals.labourPaise / 100;
  for (const row of [split, split2]) {
    row.getCell(COL.desc).alignment = { horizontal: 'right' };
    row.getCell(COL.desc).font = { name: 'Calibri', size: 10, color: { argb: GREY } };
    row.getCell(COL.total).numFmt = RUPEES;
    row.getCell(COL.total).font = { name: 'Calibri', size: 10, bold: true };
  }

  // Branch-wise summary when the statement covers more than one branch.
  const branches = [...new Set(jobs.map(j => j.branchId))];
  if (branches.length > 1) addBranchSummary(wb, input, jobs);

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

function addBranchSummary(wb: ExcelJS.Workbook, input: ExcelStatementInput, jobs: CivilJobWithLines[]) {
  const ws = wb.addWorksheet('By branch', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 26 }, { width: 16 }, { width: 10 }, { width: 15 }, { width: 15 }, { width: 16 }];

  ws.mergeCells(1, 1, 1, 6);
  const t = ws.getCell(1, 1);
  t.value = `${input.title.toUpperCase()}  —  BY BRANCH  ·  ${input.period}`;
  t.font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } };
  t.fill = fill(GREEN);
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 26;

  const header = ['BRANCH', 'CITY', 'JOBS', 'MATERIAL', 'LABOUR', 'TOTAL'];
  const h = ws.getRow(3);
  header.forEach((v, i) => {
    const c = h.getCell(i + 1);
    c.value = v;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    c.fill = fill(GREEN);
    c.border = box(GREEN);
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  h.height = 20;

  const groups = new Map<string, CivilJobWithLines[]>();
  for (const j of jobs) groups.set(j.branchId, [...(groups.get(j.branchId) ?? []), j]);

  let r = 4;
  const rows = [...groups.values()].sort((a, b) => a[0].branchName.localeCompare(b[0].branchName));
  for (const list of rows) {
    const t2 = sumLines(list.flatMap(j => j.lines));
    const row = ws.getRow(r++);
    row.values = [list[0].branchName, list[0].cityName, list.length, t2.materialPaise / 100, t2.labourPaise / 100, t2.totalPaise / 100];
    row.eachCell({ includeEmpty: true }, (c, n) => {
      if (n > 6) return;
      c.border = box();
      c.font = { name: 'Calibri', size: 10, bold: n === 1 || n === 6 };
      if (n >= 4) c.numFmt = RUPEES;
      if (n === 3) c.alignment = { horizontal: 'center' };
      if (r % 2 === 1) c.fill = fill(CREAM_LIGHT);
    });
  }
  const all = sumLines(jobs.flatMap(j => j.lines));
  const total = ws.getRow(r);
  total.values = ['TOTAL', '', jobs.length, all.materialPaise / 100, all.labourPaise / 100, all.totalPaise / 100];
  total.eachCell({ includeEmpty: true }, (c, n) => {
    if (n > 6) return;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    c.fill = fill(GREEN);
    c.border = box(GREEN);
    if (n >= 4) c.numFmt = RUPEES;
    if (n === 3) c.alignment = { horizontal: 'center' };
  });
  total.height = 22;
}
