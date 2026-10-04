import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildCivilExcel } from '@/lib/civil/excel-statement';
import { parseCivilWorkbook } from '@/lib/civil/import-parser';
import type { CivilJobWithLines } from '@/lib/civil/server';

function job(no: number, branch: string, over: Partial<CivilJobWithLines> = {}): CivilJobWithLines {
  return {
    id: `job-${no}`, jobNo: no, jobDate: '2026-09-21', heading: 'Plumbing and blockage', remark: null,
    status: 'billed', billNo: `B-${no}`, billDate: '2026-09-30', paidDate: null, totalPaise: 235_000,
    branchId: branch, branchName: branch, companyId: 'c1', companyName: 'Dmart', cityId: 'city', cityName: 'Coimbatore',
    managerId: null, managerName: 'DEPAK', lineCount: 2,
    lines: [
      { description: 'Coupling change', kind: 'material', amountPaise: 85_000 },
      { description: 'Plumber', kind: 'labour', amountPaise: 150_000 },
    ],
    ...over,
  };
}

const jobs = [job(191, 'Sulur'), job(192, 'Thudiyalur', { status: 'done', billNo: null, billDate: null, remark: 'urgent' })];

async function build(list = jobs) {
  const buf = await buildCivilExcel({ title: 'Dmart · all branches', period: 'Sep 2026', studioName: 'Konst Design', jobs: list });
  return buf;
}

describe('buildCivilExcel', () => {
  it('writes the summary boxes and a bold green table header', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await build());
    const ws = wb.getWorksheet('Work statement')!;
    expect(ws.getCell('A1').value).toBe('DMART · ALL BRANCHES  —  WORK STATEMENT');
    expect(ws.getCell('H5').value).toBe(4700); // grand total box, rupees
    expect(ws.getCell('A7').value).toBe('S.NO');
    expect(ws.getCell('A7').font.bold).toBe(true);
    expect(wb.getWorksheet('By branch')).toBeDefined(); // two branches → branch summary
  });

  it('can be imported back without losing headings, lines or bills', async () => {
    const buf = await build();
    const parsed = parseCivilWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    expect(parsed.jobs.map(j => j.jobNo)).toEqual([191, 192]);
    const [a, b] = parsed.jobs;
    expect(a.heading).toBe('PLUMBING AND BLOCKAGE');
    expect(a.lines).toEqual([
      { description: 'Coupling change', kind: 'material', amountPaise: 85_000 },
      { description: 'Plumber', kind: 'labour', amountPaise: 150_000 },
    ]);
    expect(a.billNo).toBe('B-191');
    expect(a.mismatch).toBe(false);
    expect(b.remark).toBe('urgent');
    expect(b.mismatch).toBe(false); // the GRAND TOTAL row must not leak into the last job
    expect(parsed.storeNames).toEqual(['Sulur', 'Thudiyalur']);
  });
});
