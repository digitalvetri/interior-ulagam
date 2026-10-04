import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Real costs are the owner's private numbers. They must never reach a client
 * download (Excel/PDF) or a response an accountant can read. This fails if a
 * file that feeds those starts touching cost columns, so leaking costs becomes
 * a deliberate, reviewed change instead of an accident.
 */
const ROOT = join(__dirname, '..', 'src');
const COST = /costPaise|cost_paise|civilJobCosts|civil_job_costs/;

const MUST_NOT_TOUCH_COSTS = [
  'app/api/v1/civil/export/route.ts',
  'app/api/v1/civil/export/pdf/route.ts',
  'lib/civil/excel-statement.ts',
  'lib/pdf/civil-statement.tsx',
  // Readable by accountants (ROLES.CIVIL):
  'app/api/v1/civil/jobs/route.ts',
  'app/api/v1/civil/jobs/[id]/route.ts',
  'app/api/v1/civil/jobs/bulk-status/route.ts',
  'app/api/v1/civil/jobs/[id]/status/route.ts',
  'app/api/v1/civil/companies/route.ts',
  'app/api/v1/civil/companies/[id]/route.ts',
  'app/api/v1/civil/branches/[id]/route.ts',
  'app/api/v1/civil/summary/route.ts',
];

function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}`) >= 0
    ? source.indexOf(`export function ${name}`) : source.indexOf(`export async function ${name}`);
  expect(start, `${name} not found`).toBeGreaterThanOrEqual(0);
  const next = source.indexOf('\nexport ', start + 10);
  return source.slice(start, next < 0 ? undefined : next);
}

describe('real costs stay private', () => {
  it.each(MUST_NOT_TOUCH_COSTS)('%s never reads cost columns', (rel) => {
    expect(COST.test(readFileSync(join(ROOT, rel), 'utf8')), `${rel} references costs`).toBe(false);
  });

  it('the shared job queries used by lists and downloads select no cost', () => {
    const server = readFileSync(join(ROOT, 'lib/civil/server.ts'), 'utf8');
    for (const fn of ['jobListQuery', 'jobsWithLines']) {
      expect(COST.test(functionBody(server, fn)), `${fn} selects a cost column`).toBe(false);
    }
  });

  it('every civil route that reads costs is owner-only, reads included', () => {
    const api = join(ROOT, 'app/api/v1/civil');
    const walk = (dir: string): string[] => readdirSync(dir).flatMap(e => {
      const full = join(dir, e);
      return statSync(full).isDirectory() ? walk(full) : e === 'route.ts' ? [full] : [];
    });
    for (const file of walk(api)) {
      const src = readFileSync(file, 'utf8');
      if (!COST.test(src) && !/profit/.test(file)) continue;
      const handlers = src.match(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\b/g) ?? [];
      const ownerGuards = src.match(/requireApiRole\(ctx, ROLES\.OWNER_ONLY\)/g) ?? [];
      expect(ownerGuards.length, `${file} exposes costs without OWNER_ONLY on every handler`).toBeGreaterThanOrEqual(handlers.length);
    }
  });
});
