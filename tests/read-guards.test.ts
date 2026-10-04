import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * role-enforcement.test.ts only scans mutating handlers. These GETs return
 * salaries, payslips, finance, real costs or everyone's attendance, so each
 * must carry the role guard that matches its sidebar module. A regression
 * here would silently reopen data to every signed-in role.
 */
const API = join(__dirname, '..', 'src', 'app', 'api', 'v1');

const GUARDED_GETS: [string, string][] = [
  ['employees/[id]/route.ts', 'OWNER_ONLY'],
  ['payroll/runs/route.ts', 'OWNER_ONLY'],
  ['payroll/runs/[id]/route.ts', 'OWNER_ONLY'],
  ['exports/[kind]/route.ts', 'OWNER_ONLY'],
  ['analytics/overview/route.ts', 'OWNER_ONLY'],
  ['projects/[id]/pnl/route.ts', 'OWNER_ONLY'],
  ['projects/[id]/cost-to-complete/route.ts', 'OWNER_ONLY'],
  ['settings/profile/route.ts', 'OWNER_ONLY'],
  ['settings/integrations/route.ts', 'OWNER_ONLY'],
  ['attendance/summary/route.ts', 'FINANCE'],
  ['finance/overview/route.ts', 'FINANCE'],
  ['finance/gst/route.ts', 'FINANCE'],
  ['finance/vendor-payables/route.ts', 'FINANCE'],
  ['accounts/overview/route.ts', 'FINANCE'],
  ['accounts/receivables/route.ts', 'FINANCE'],
  ['invoices/route.ts', 'FINANCE'],
  ['invoices/[id]/route.ts', 'FINANCE'],
  ['invoices/[id]/pdf/route.ts', 'FINANCE'],
  ['payments/route.ts', 'FINANCE'],
  ['payments/[id]/receipt/route.ts', 'FINANCE'],
  ['vendor-bills/[id]/receipt/route.ts', 'FINANCE'],
];

function getHandler(source: string): string {
  const start = source.indexOf('export async function GET');
  expect(start, 'GET handler not found').toBeGreaterThanOrEqual(0);
  const next = source.indexOf('\nexport async function', start + 10);
  return source.slice(start, next < 0 ? undefined : next);
}

describe('sensitive reads are role-guarded', () => {
  it.each(GUARDED_GETS)('%s GET requires %s', (rel, roleSet) => {
    const body = getHandler(readFileSync(join(API, rel), 'utf8'));
    expect(body).toContain(`requireApiRole(ctx, ROLES.${roleSet})`);
    expect(body).toMatch(/if \(denied\) return denied;/);
  });

  it('the employees list hides full records from non-owners', () => {
    const body = getHandler(readFileSync(join(API, 'employees/route.ts'), 'utf8'));
    const start = body.indexOf("if (ctx.role !== 'owner')");
    expect(start).toBeGreaterThanOrEqual(0);
    const branch = body.slice(start, body.indexOf('\n    }\n', start));
    // An explicit projection, never the spread row (which carries salary, DOB, permissions).
    expect(branch).not.toContain('...r');
    expect(branch).not.toMatch(/salaryPaise|dob|emergencyContact|permissionsJson/);
  });

  it('client portal links are issued by POST, never GET', () => {
    const src = readFileSync(join(API, 'projects/[id]/client-token/route.ts'), 'utf8');
    expect(src).not.toContain('export async function GET');
    expect(src).toContain('export async function POST');
  });

  it('notifications are scoped to the recipient', () => {
    for (const rel of ['notifications/route.ts', 'notifications/[id]/route.ts']) {
      expect(readFileSync(join(API, rel), 'utf8')).toContain('visibleTo(ctx)');
    }
  });
});
