import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, deliverables, siteLogs, snagItems, expenses } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, sql, inArray } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const [
      [deliverableRow],
      [siteLogRow],
      [snagRow],
      [expenseRow],
    ] = await Promise.all([
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(deliverables)
        .where(eq(deliverables.projectId, id)),

      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(siteLogs)
        .where(and(eq(siteLogs.projectId, id), eq(siteLogs.tenantId, ctx.tenantId))),

      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(snagItems)
        .where(and(
          eq(snagItems.projectId, id),
          inArray(snagItems.status, ['open', 'in_progress']),
        )),

      db
        .select({
          count: sql<number>`COUNT(*)::int`,
          totalPaise: sql<number>`COALESCE(SUM(${expenses.amountPaise}), 0)::int`,
        })
        .from(expenses)
        .where(and(eq(expenses.projectId, id), eq(expenses.tenantId, ctx.tenantId))),
    ]);

    return NextResponse.json({
      data: {
        deliverableCount: deliverableRow?.count ?? 0,
        siteLogCount: siteLogRow?.count ?? 0,
        openSnagCount: snagRow?.count ?? 0,
        expenseCount: expenseRow?.count ?? 0,
        expenseTotalPaise: expenseRow?.totalPaise ?? 0,
      },
    });
  } catch (err) {
    console.error('[projects/:id/summary GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
