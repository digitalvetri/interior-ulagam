import { istToday } from '@/lib/dates/ist';
import ExcelJS from 'exceljs';

// Client account statement as a styled workbook — twin of the PDF statement.

const GREEN = 'FF1F4A36';
const CREAM = 'FFF1EDE4';
const LINE = 'FFD9D1C2';
const GREY = 'FF5E625B';
const WHITE = 'FFFFFFFF';
const RUPEES = '"₹"#,##0;-"₹"#,##0;"–"';
/** Balance column: a negative balance (client paid ahead) reads as "₹27,280 Cr". */
const BALANCE = '"₹"#,##0;"₹"#,##0" Cr";"–"';

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = (argb = LINE): Partial<ExcelJS.Border> => ({ style: 'thin', color: { argb } });
const box = (argb = LINE): Partial<ExcelJS.Borders> => ({ top: thin(argb), left: thin(argb), bottom: thin(argb), right: thin(argb) });

export interface LedgerExcelInput {
  studioName: string;
  clientName: string;
  scope: string;
  rows: { date: string; label: string; projectName: string | null; owedPaise: number; paidPaise: number; balancePaise: number }[];
  totals: { contractWithGstPaise: number; duePaise: number; receivedPaise: number; outstandingPaise: number; advancePaise: number };
}

export async function buildLedgerExcel(input: LedgerExcelInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = input.studioName;
  const ws = wb.addWorksheet('Statement', {
    views: [{ state: 'frozen', ySplit: 6, showGridLines: false }],
    pageSetup: { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '6:6' },
  });
  ws.columns = [{ width: 12 }, { width: 46 }, { width: 22 }, { width: 15 }, { width: 15 }, { width: 16 }];

  ws.mergeCells(1, 1, 1, 6);
  const t = ws.getCell(1, 1);
  t.value = `${input.clientName.toUpperCase()}  —  ACCOUNT STATEMENT`;
  t.font = { name: 'Calibri', size: 15, bold: true, color: { argb: WHITE } };
  t.fill = fill(GREEN); t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 28;
  ws.mergeCells(2, 1, 2, 6);
  const s = ws.getCell(2, 1);
  s.value = `${input.scope}  ·  Prepared by ${input.studioName} on ${istToday().split('-').reverse().join('-')}  ·  Amounts include GST`;
  s.font = { name: 'Calibri', size: 10, italic: true, color: { argb: GREY } };

  const balanceLabel = input.totals.advancePaise > 0 ? 'ADVANCE WITH US' : 'BALANCE DUE';
  const cards: [string, number, number][] = [
    ['CONTRACT', input.totals.contractWithGstPaise, 1], ['DUE SO FAR', input.totals.duePaise, 2],
    ['RECEIVED', input.totals.receivedPaise, 4], [balanceLabel, input.totals.advancePaise || input.totals.outstandingPaise, 6],
  ];
  for (const [label, value, col] of cards) {
    const accent = col === 6;
    const l = ws.getCell(3, col); const v = ws.getCell(4, col);
    l.value = label; v.value = value / 100; v.numFmt = RUPEES;
    l.font = { name: 'Calibri', size: 8, bold: true, color: { argb: accent ? WHITE : GREY } };
    v.font = { name: 'Calibri', size: 14, bold: true, color: { argb: accent ? WHITE : 'FF1A1D1A' } };
    for (const c of [l, v]) { c.fill = fill(accent ? GREEN : CREAM); c.border = box(GREEN); c.alignment = { indent: 1, vertical: 'middle' }; }
  }
  ws.getRow(4).height = 24;

  const head = ws.getRow(6);
  ['DATE', 'PARTICULARS', 'PROJECT', 'DUE', 'PAID', 'BALANCE'].forEach((h, i) => {
    const c = head.getCell(i + 1);
    c.value = h; c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    c.fill = fill(GREEN); c.border = box(GREEN); c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  head.height = 20;

  let r = 7;
  for (const row of input.rows) {
    const x = ws.getRow(r++);
    x.values = [row.date.split('-').reverse().join('-'), row.label, row.projectName ?? '', row.owedPaise / 100 || null, row.paidPaise / 100 || null, row.balancePaise / 100];
    for (let c = 1; c <= 6; c++) {
      const cell = x.getCell(c);
      cell.border = box();
      cell.font = { name: 'Calibri', size: 10, bold: c === 6, color: { argb: c === 5 ? 'FF17684A' : 'FF262924' } };
      if (c >= 4) cell.numFmt = c === 6 ? BALANCE : RUPEES;
      if (row.owedPaise > 0 && c <= 3) cell.fill = fill('FFFAF8F3');
    }
  }
  const owed = input.rows.reduce((a, b) => a + b.owedPaise, 0);
  const paid = input.rows.reduce((a, b) => a + b.paidPaise, 0);
  const close = ws.getRow(r + 1);
  close.values = ['', 'CLOSING BALANCE', '', owed / 100, paid / 100, (owed - paid) / 100];
  for (let c = 1; c <= 6; c++) {
    const cell = close.getCell(c);
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    cell.fill = fill(GREEN); cell.border = box(GREEN);
    if (c >= 4) cell.numFmt = RUPEES;
  }
  close.height = 22;

  return Buffer.from(await wb.xlsx.writeBuffer());
}
