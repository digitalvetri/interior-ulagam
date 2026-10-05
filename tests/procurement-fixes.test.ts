import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { roundQty, pendingQty, receiptStatus, nextDocNumber, hasPgCode } from '@/lib/procurement/receipts';
import { toExportRows, RUPEE_SUFFIX } from '@/lib/reports/export-rows';
import { findImportRowProblems, describeImportError } from '@/lib/civil/import-validate';
import { CivilImportCommitInput } from '@/types/civil';
import { errorText } from '@/lib/client-feedback';
import { escapeXml, toReceiptVoucherXml } from '@/lib/tally';

const api = (p: string) => readFileSync(join(__dirname, '../src/app/api/v1', p), 'utf8');

describe('procurement receipt math', () => {
  it('rounds quantities to 3 dp without float drift', () => {
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
    expect(roundQty(12.34567)).toBe(12.346);
  });

  it('pending qty tolerates fractional lines and never goes negative', () => {
    expect(pendingQty(12.5, 10.2)).toBe(2.3);
    expect(pendingQty(1, 0.7 + 0.3)).toBe(0);
    expect(pendingQty(5, 6)).toBe(0);
  });

  it('a fractional line can be fully received', () => {
    const lines = [{ id: 'a', qty: 12.5 }, { id: 'b', qty: 3 }];
    expect(receiptStatus(lines, { a: 12.5, b: 3 })).toBe('complete');
    expect(receiptStatus(lines, { a: 0.1 + 0.2 })).toBe('partial');
    expect(receiptStatus(lines, {})).toBeNull();
    expect(receiptStatus([], {})).toBeNull();
  });

  it('numbers from the highest existing sequence, not the row count', () => {
    expect(nextDocNumber('PO', 2026, [])).toBe('PO-2026-001');
    expect(nextDocNumber('PO', 2026, ['PO-2026-001', 'PO-2026-007', null, 'PO-2025-099'])).toBe('PO-2026-008');
    expect(nextDocNumber('GRN', 2026, ['GRN-2026-999'])).toBe('GRN-2026-1000');
    expect(nextDocNumber('PO', 2026, ['PO-2026-abc'])).toBe('PO-2026-001');
  });

  it('finds a Postgres error code on wrapped errors', () => {
    expect(hasPgCode({ code: '23503' }, '23503')).toBe(true);
    expect(hasPgCode(new Error('x', { cause: { code: '23505' } }), '23505')).toBe(true);
    expect(hasPgCode(new Error('x'), '23505')).toBe(false);
    expect(hasPgCode(null, '23505')).toBe(false);
  });
});

describe('purchase-order route guards (source)', () => {
  const po = api('purchase-orders/[id]/route.ts');
  it('status changes are open to procurement; advance + delete stay owner-only', () => {
    expect(po).toMatch(/PATCH[\s\S]*requireApiRole\(ctx, ROLES\.PROCUREMENT\)/);
    expect(po).toMatch(/advancePaidPaise !== undefined\) \{\s*const ownerOnly = requireApiRole\(ctx, ROLES\.OWNER_ONLY\)/);
    expect(po).toMatch(/DELETE[\s\S]*requireApiRole\(ctx, ROLES\.OWNER_ONLY\)/);
  });
  it('GRNs accept decimal quantities', () => {
    expect(api('purchase-orders/[id]/grn/route.ts')).not.toMatch(/receivedQty: z\.number\(\)\.int\(\)/);
  });
});

describe('report export rows', () => {
  it('turns paise (incl. bigint strings) into rupee numbers under ₹ headers', () => {
    const [row] = toExportRows([{ vendorId: 'x', vendorName: 'Acme', poCount: 2, totalPaise: '123456', advancePaise: 50 }]);
    expect(row).toEqual({ 'Vendor Name': 'Acme', 'Po Count': 2, [`Total${RUPEE_SUFFIX}`]: 1234.56, [`Advance${RUPEE_SUFFIX}`]: 0.5 });
  });
});

describe('civil import row validation', () => {
  const good = {
    jobNo: 12, jobDate: '2026-01-02', storeName: 'S1', heading: 'Paint', remark: null,
    managerName: null, billNo: null, billDate: null,
    lines: [{ description: 'Wall', kind: 'labour', amountPaise: 1000 }],
  };

  it('flags only the bad rows, by S.No and field', () => {
    const bad = { ...good, jobNo: 37, lines: [good.lines[0], { description: 'Door', kind: 'labour', amountPaise: -500 }] };
    const long = { ...good, jobNo: 40, heading: 'x'.repeat(201) };
    const problems = findImportRowProblems([good, bad, long]);
    expect(problems.map(p => p.jobNo)).toEqual([37, 40]);
    expect(problems[0].messages[0]).toBe('S.No 37, line 2 (amount): amount can’t be negative');
    expect(problems[1].messages[0]).toMatch(/^S\.No 40 \(work heading\): /);
  });

  it('server message names the S.No instead of an array index', () => {
    const body = {
      storeMap: [{ storeName: 'S1', companyName: 'C', cityName: 'X', branchName: 'B' }],
      jobs: [good, { ...good, jobNo: 99, lines: [{ description: 'Door', kind: 'labour', amountPaise: -1 }] }],
    };
    const r = CivilImportCommitInput.safeParse(body);
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = describeImportError(r.error, body);
      expect(msg).toContain('S.No 99, line 1 (amount)');
      expect(msg).not.toMatch(/jobs\.1/);
    }
  });
});

describe('client error text', () => {
  it('handles strings, flatten() objects and { message }', () => {
    expect(errorText('Boom')).toBe('Boom');
    const flat = z.object({ name: z.string().min(1, 'Name is required') }).safeParse({ name: '' });
    expect(flat.success).toBe(false);
    if (!flat.success) expect(errorText(flat.error.flatten())).toBe('name: Name is required');
    expect(errorText({ formErrors: ['Top level'], fieldErrors: {} })).toBe('Top level');
    expect(errorText({ message: 'From message' })).toBe('From message');
    expect(errorText({ formErrors: [], fieldErrors: {} })).toBeUndefined();
    expect(errorText(42)).toBeUndefined();
  });
});

describe('tally XML', () => {
  it('escapes & < > " \'', () => {
    expect(escapeXml(`A&B <C> "D" 'E'`)).toBe('A&amp;B &lt;C&gt; &quot;D&quot; &apos;E&apos;');
  });
  it('receipt vouchers carry the payment amount and escaped names', () => {
    const xml = toReceiptVoucherXml([
      { date: '20260102', voucherNumber: 'INV-1', partyLedgerName: 'Rao & Sons <Villa>', amountPaise: 12345, narration: 'x' },
    ]);
    expect(xml).toContain('<AMOUNT>123.45</AMOUNT>');
    expect(xml).toContain('Rao &amp; Sons &lt;Villa&gt;');
    expect(xml).not.toContain('Rao & Sons');
  });
});
