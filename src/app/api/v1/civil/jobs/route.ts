import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { civilJobEvents, civilJobs } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { listRange, takePage } from '@/lib/pagination';
import { CivilJobInput } from '@/types/civil';
import { sumLines } from '@/lib/civil/totals';
import {
  invalid, isUniqueViolation, jobFilterConditions, jobListQuery, nextJobNo, ownsBranch, ownsManager,
  readJson, syncLines, serverError,
} from '@/lib/civil/server';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const filters = jobFilterConditions(request.nextUrl.searchParams);
  if (!filters.ok) return NextResponse.json({ error: filters.error }, { status: 400 });
  const range = listRange(request);

  try {
    const rows = await jobListQuery(ctx.tenantId, filters.conditions)
      .orderBy(desc(civilJobs.jobNo))
      .limit(range.limit + 1)
      .offset(range.offset);
    const { page, hasMore } = takePage(rows, range);
    return NextResponse.json({ data: page, hasMore, limit: range.limit, offset: range.offset });
  } catch (err) {
    return serverError('civil/jobs GET', err);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.CIVIL);
  if (denied) return denied;

  const parsed = CivilJobInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const { lines, managerId, ...fields } = parsed.data;

  try {
    if (!(await ownsBranch(ctx.tenantId, fields.branchId))) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }
    if (managerId && !(await ownsManager(ctx.tenantId, managerId))) {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    }

    // Two people saving at once can pick the same next number; the unique index
    // rejects the loser, who simply takes the next one.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const job = await db.transaction(async (tx) => {
          const jobNo = await nextJobNo(ctx.tenantId, tx);
          const [row] = await tx.insert(civilJobs).values({
            tenantId: ctx.tenantId, jobNo, ...fields, managerId: managerId ?? null,
            totalPaise: sumLines(lines).totalPaise, createdBy: ctx.dbUserId,
          }).returning();
          await syncLines(tx, ctx.tenantId, row.id, lines);
          await tx.insert(civilJobEvents).values({
            tenantId: ctx.tenantId, jobId: row.id, fromStatus: null, toStatus: 'done', createdBy: ctx.dbUserId,
          });
          return row;
        });
        return NextResponse.json({ data: job }, { status: 201 });
      } catch (err) {
        if (!isUniqueViolation(err) || attempt === 2) throw err;
      }
    }
    return serverError('civil/jobs POST', new Error('unreachable'));
  } catch (err) {
    return serverError('civil/jobs POST', err);
  }
}
