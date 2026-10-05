import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  civilBranches, civilCompanies, civilJobEvents, civilJobLines, civilJobs, civilManagers,
} from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { CivilImportCommitInput } from '@/types/civil';
import { sumLines } from '@/lib/civil/totals';
import { findOrCreateCity, readJson, serverError } from '@/lib/civil/server';
import { describeImportError } from '@/lib/civil/import-validate';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const CHUNK = 500;
function chunks<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK));
  return out;
}

async function companyId(tx: Tx, tenantId: string, name: string, created: { n: number }): Promise<string> {
  const [hit] = await tx.select({ id: civilCompanies.id }).from(civilCompanies)
    .where(and(eq(civilCompanies.tenantId, tenantId), sql`lower(${civilCompanies.name}) = lower(${name})`)).limit(1);
  if (hit) return hit.id;
  created.n++;
  const [row] = await tx.insert(civilCompanies).values({ tenantId, name }).returning({ id: civilCompanies.id });
  return row.id;
}

async function branchId(
  tx: Tx, tenantId: string, company: string, city: string, name: string, created: { n: number },
): Promise<string> {
  const [hit] = await tx.select({ id: civilBranches.id }).from(civilBranches)
    .where(and(
      eq(civilBranches.tenantId, tenantId), eq(civilBranches.companyId, company), eq(civilBranches.cityId, city),
      sql`lower(${civilBranches.name}) = lower(${name})`,
    )).limit(1);
  if (hit) return hit.id;
  created.n++;
  const [row] = await tx.insert(civilBranches).values({ tenantId, companyId: company, cityId: city, name })
    .returning({ id: civilBranches.id });
  return row.id;
}

/**
 * Commit an Excel import that the browser has parsed and the user has mapped.
 * All-or-nothing. Jobs whose S.No already exists are skipped, so running the
 * same file twice adds nothing the second time.
 */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const body = await readJson(request);
  const parsed = CivilImportCommitInput.safeParse(body);
  if (!parsed.success) {
    // Name the S.No and column, not an array index like "jobs.37.lines.2".
    return NextResponse.json(
      { error: describeImportError(parsed.error, body), details: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { storeMap, jobs } = parsed.data;
  const tenantId = ctx.tenantId;

  const unmapped = [...new Set(jobs.map(j => j.storeName))].filter(s => !storeMap.some(m => m.storeName === s));
  if (unmapped.length) {
    return NextResponse.json({ error: `Map every store name first: ${unmapped.join(', ')}` }, { status: 422 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const companiesCreated = { n: 0 };
      const branchesCreated = { n: 0 };
      const managersCreated = { n: 0 };

      // Store name → branch id
      const branchOf = new Map<string, string>();
      for (const m of storeMap) {
        const cId = await companyId(tx, tenantId, m.companyName, companiesCreated);
        const cityId = await findOrCreateCity(tenantId, m.cityName, tx);
        branchOf.set(m.storeName, await branchId(tx, tenantId, cId, cityId, m.branchName, branchesCreated));
      }

      // Manager name → id
      const managerOf = new Map<string, string>();
      for (const name of [...new Set(jobs.map(j => j.managerName).filter((n): n is string => !!n))]) {
        const [hit] = await tx.select({ id: civilManagers.id }).from(civilManagers)
          .where(and(eq(civilManagers.tenantId, tenantId), sql`lower(${civilManagers.name}) = lower(${name})`)).limit(1);
        if (hit) { managerOf.set(name, hit.id); continue; }
        const [row] = await tx.insert(civilManagers).values({ tenantId, name }).returning({ id: civilManagers.id });
        managersCreated.n++;
        managerOf.set(name, row.id);
      }

      const existing = new Set<number>();
      for (const part of chunks(jobs.map(j => j.jobNo))) {
        const rows = await tx.select({ jobNo: civilJobs.jobNo }).from(civilJobs)
          .where(and(eq(civilJobs.tenantId, tenantId), inArray(civilJobs.jobNo, part)));
        rows.forEach(r => existing.add(r.jobNo));
      }

      const seen = new Set<number>();
      const fresh = jobs.filter(j => {
        if (existing.has(j.jobNo) || seen.has(j.jobNo)) return false;
        seen.add(j.jobNo);
        return true;
      });
      const skipped = jobs.filter(j => !fresh.includes(j)).map(j => j.jobNo);

      for (const part of chunks(fresh)) {
        const inserted = await tx.insert(civilJobs).values(part.map(j => {
          const billed = !!(j.billNo || j.billDate);
          return {
            tenantId,
            jobNo: j.jobNo,
            branchId: branchOf.get(j.storeName)!,
            jobDate: j.jobDate,
            heading: j.heading,
            remark: j.remark,
            managerId: j.managerName ? managerOf.get(j.managerName) ?? null : null,
            status: billed ? 'billed' as const : 'done' as const,
            // The sheet sometimes has a billing date without a bill number (or the reverse).
            billNo: billed ? (j.billNo ?? `S.No ${j.jobNo}`) : null,
            billDate: billed ? (j.billDate ?? j.jobDate) : null,
            totalPaise: sumLines(j.lines).totalPaise,
            createdBy: ctx.dbUserId,
          };
        })).returning({ id: civilJobs.id, jobNo: civilJobs.jobNo, status: civilJobs.status });

        const idOf = new Map(inserted.map(r => [r.jobNo, r.id]));
        const lineRows = part.flatMap(j => j.lines.map((l, position) => ({
          tenantId, jobId: idOf.get(j.jobNo)!, position,
          description: l.description, kind: l.kind, amountPaise: l.amountPaise,
        })));
        for (const lp of chunks(lineRows)) await tx.insert(civilJobLines).values(lp);
        await tx.insert(civilJobEvents).values(inserted.map(r => ({
          tenantId, jobId: r.id, fromStatus: null, toStatus: r.status, note: 'Imported from Excel', createdBy: ctx.dbUserId,
        })));
      }

      return {
        created: fresh.length,
        skipped,
        companiesCreated: companiesCreated.n,
        branchesCreated: branchesCreated.n,
        managersCreated: managersCreated.n,
      };
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err) {
    return serverError('civil/import POST', err);
  }
}
