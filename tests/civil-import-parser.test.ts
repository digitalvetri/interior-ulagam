import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { lineKind, parseCivilWorkbook, toIsoDate } from '@/lib/civil/import-parser';

// Rows 1115–1137 of the client's "BILL NEW - SHERIFF VINU" sheet, as photographed.
// Columns: A S,NO · B DATE · C STORE NAME · D COMPLAINTS · E MATRIAL / LABOUR ·
//          F TOTAL · G REMARK · H BILLING · I BILLING DATE · J MANNAGER
const N = null;
const rows: (string | number | null)[][] = [
  ['S,NO', 'DATE', 'STORE NAME', 'COMPLAINTS', 'MATRIAL / LABOUR', 'TOTAL', 'REMARK', 'BILLING', 'BILLING DATE', 'MANNAGER'],
  // 188 — rows 1..3
  [188, '16-09-2026', 'SINGANALLUR', N, 'FIRE TANK CLEANNING', N, N, N, N, 'DEPAK'],
  [N, N, N, 'SEWAGE VECHILE 2 TRIPS', N, N, N, N, N, N],
  [N, N, N, N, 5400, N, N, N, N, N],
  // 189 — rows 4..6
  [189, '16-09-2026', 'CHINAMPALAYAM', 'TOTAL TANK 204981', 'WATER TANK CLEANING', N, N, 'B-101', '30-09-2026', 'KISHORE'],
  [N, N, N, 'DOMESTIC TANK 36180,FIRE TANK 84400,84400', 24597, N, N, N, N, N],
  [N, N, N, N, N, N, N, N, N, N],
  // 190 — rows 7..9
  [190, '21-09-2026', 'TIRUPUR -1', N, 'URINAL BLOCKAGE', N, N, N, N, 'KISHORE'],
  [N, N, N, 'ACID MATRIAL', 560, N, N, N, N, N],
  [N, N, N, 'LABOUR', 1500, 2060, N, N, N, N],
  // 191 — rows 10..15
  [191, 46281, 'SULUR', N, 'WELDING AND FABRICATION WORK', N, N, N, N, 'DEPAK'],
  [N, N, N, 'ROOF AND STAIR CASE MS MATRIAL', 6000, N, N, N, N, N],
  [N, N, N, 'SALARY FOR WELDER 19-09-2026/20-09-2026', 6000, N, N, N, N, N],
  [N, N, N, 'WELDER SALARY 22-09-2026', 3000, N, N, N, N, N],
  [N, N, N, '23-09-2026/24-09-2026/25-09-2026 LABOUR', 9000, N, N, N, N, N],
  [N, N, N, '26-09-2026 LABOUR', 4500, 28500, N, N, N, N],
  // 192 — rows 16..18, stated total deliberately wrong
  [192, '21-09-2026', 'SULUR', N, 'PLUMBING AND BLOCKAGE', N, N, N, N, 'DEPAK'],
  [N, N, N, 'COUPLING CHANGE IN WASHING AREA', '850', N, N, N, N, N],
  [N, N, N, 'LABOUR', '1,500', 2450, N, N, N, N],
];

function workbook(): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // The sheet merges S.NO / DATE / STORE / MANAGER down each job's rows.
  const blocks: [number, number][] = [[1, 3], [4, 6], [7, 9], [10, 15], [16, 18]];
  ws['!merges'] = blocks.flatMap(([s, e]) =>
    [0, 1, 2, 9].map(c => ({ s: { r: s, c }, e: { r: e, c } })),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['OFFICE ADDRESS']]), 'OFFICE ADDRESS');
  XLSX.utils.book_append_sheet(wb, ws, 'BILL NEW - SHERIFF VINU');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('parseCivilWorkbook', () => {
  const result = parseCivilWorkbook(workbook());
  const job = (no: number) => result.jobs.find(j => j.jobNo === no)!;

  it('finds the job sheet by its header row and every job block', () => {
    expect(result.sheetName).toBe('BILL NEW - SHERIFF VINU');
    expect(result.jobs.map(j => j.jobNo)).toEqual([188, 189, 190, 191, 192]);
    expect(result.storeNames).toEqual(['CHINAMPALAYAM', 'SINGANALLUR', 'SULUR', 'TIRUPUR -1']);
    expect(result.managerNames).toEqual(['DEPAK', 'KISHORE']);
  });

  it('pairs a description with the amount on the next row when they are split', () => {
    expect(job(188).heading).toBe('FIRE TANK CLEANNING');
    expect(job(188).lines).toEqual([{ description: 'SEWAGE VECHILE 2 TRIPS', kind: 'material', amountPaise: 540_000 }]);
    expect(job(188).remark).toBeNull();
  });

  it('pairs by row, sending amount-less text to the remark', () => {
    expect(job(189).lines).toEqual([
      { description: 'DOMESTIC TANK 36180,FIRE TANK 84400,84400', kind: 'material', amountPaise: 2_459_700 },
    ]);
    expect(job(189).remark).toBe('TOTAL TANK 204981');
    expect(job(189).billNo).toBe('B-101');
    expect(job(189).billDate).toBe('2026-09-30');
    expect(job(189).managerName).toBe('KISHORE');
  });

  it('classifies labour, salary and welder lines as labour', () => {
    expect(job(190).lines.map(l => l.kind)).toEqual(['material', 'labour']);
    expect(job(191).lines.map(l => l.kind)).toEqual(['material', 'labour', 'labour', 'labour', 'labour']);
  });

  it('reads Excel serial dates and dd-mm-yyyy strings', () => {
    expect(job(191).jobDate).toBe('2026-09-16');
    expect(job(190).jobDate).toBe('2026-09-21');
  });

  it('flags a stated total that disagrees with its lines', () => {
    expect(job(190).mismatch).toBe(false);
    expect(job(191).statedTotalPaise).toBe(2_850_000);
    expect(job(191).mismatch).toBe(false);
    expect(job(192).lines.reduce((s, l) => s + l.amountPaise, 0)).toBe(235_000);
    expect(job(192).mismatch).toBe(true);
  });

  it('throws a readable error when no sheet has the expected header', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['hello']]), 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    expect(() => parseCivilWorkbook(buf)).toThrow(/S.NO/);
  });
});

describe('sheet choice', () => {
  // The client's workbook also has a PENDING WORK tab that may share the columns.
  function twoSheets(): ArrayBuffer {
    const wb = XLSX.read(workbook(), { type: 'array' });
    const pending = XLSX.utils.aoa_to_sheet([rows[0], [500, '01-10-2026', 'SULUR', 'LEAK', 300, N, N, N, N, 'DEPAK']]);
    const out = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(out, pending, 'PENDING WORK');
    XLSX.utils.book_append_sheet(out, wb.Sheets['BILL NEW - SHERIFF VINU'], 'BILL NEW - SHERIFF VINU');
    return XLSX.write(out, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  }

  it('lists every sheet with job columns and defaults to the one with most jobs', () => {
    const r = parseCivilWorkbook(twoSheets());
    expect(r.sheets).toEqual([
      { name: 'PENDING WORK', jobCount: 1 },
      { name: 'BILL NEW - SHERIFF VINU', jobCount: 5 },
    ]);
    expect(r.sheetName).toBe('BILL NEW - SHERIFF VINU');
  });

  it('parses the sheet asked for', () => {
    const r = parseCivilWorkbook(twoSheets(), 'PENDING WORK');
    expect(r.sheetName).toBe('PENDING WORK');
    expect(r.jobs.map(j => j.jobNo)).toEqual([500]);
  });
});

describe('lineKind', () => {
  it('prefers an explicit TYPE cell over the wording', () => {
    expect(lineKind('MS material', 'LABOUR')).toBe('labour');
    expect(lineKind('Welder labour', 'MATERIAL')).toBe('material');
    expect(lineKind('Welder labour')).toBe('labour');
  });
});

describe('toIsoDate', () => {
  it('never reads dd-mm as mm-dd', () => {
    expect(toIsoDate('05-09-2026')).toBe('2026-09-05');
    expect(toIsoDate('5/9/26')).toBe('2026-09-05');
    expect(toIsoDate('31-02-2026')).toBeNull();
    expect(toIsoDate('soon')).toBeNull();
  });
});
