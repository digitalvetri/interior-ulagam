import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { milestones, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, inArray, and } from 'drizzle-orm';
import type { ReceivableItem } from '@/types/accounts';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const overdueOnly = searchParams.get('overdueOnly') === 'true';

  try {
    // milestones has no tenantId — scope through projects
    const tenantProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.tenantId, ctx.tenantId));

    if (tenantProjects.length === 0) {
      return NextResponse.json({
        data: { items: [], totalOutstandingPaise: 0, totalOverduePaise: 0 },
      });
    }

    const projectIds = tenantProjects.map((p) => p.id);
    const projectNameMap = new Map(tenantProjects.map((p) => [p.id, p.name]));

    const outstandingStatuses: Array<'pending' | 'link_sent' | 'overdue'> = overdueOnly
      ? ['overdue']
      : ['pending', 'link_sent', 'overdue'];

    const rows = await db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        label: milestones.label,
        amountPaise: milestones.amountPaise,
        paymentStatus: milestones.paymentStatus,
        createdAt: milestones.createdAt,
      })
      .from(milestones)
      .where(
        and(
          inArray(milestones.projectId, projectIds),
          inArray(milestones.paymentStatus, outstandingStatuses),
        ),
      );

    const filtered = rows;

    const now = Date.now();

    const items: ReceivableItem[] = filtered.map((row) => {
      const createdAtMs = new Date(row.createdAt).getTime();
      const daysSinceCreation = Math.floor((now - createdAtMs) / (1000 * 60 * 60 * 24));

      return {
        id: row.id,
        projectId: row.projectId,
        projectName: projectNameMap.get(row.projectId) ?? '',
        label: row.label,
        amountPaise: row.amountPaise,
        paymentStatus: row.paymentStatus as 'pending' | 'link_sent' | 'overdue',
        createdAt: row.createdAt.toISOString(),
        daysSinceCreation,
      };
    });

    const totalOutstandingPaise = items.reduce((sum, item) => sum + item.amountPaise, 0);
    const totalOverduePaise = items
      .filter((item) => item.paymentStatus === 'overdue')
      .reduce((sum, item) => sum + item.amountPaise, 0);

    return NextResponse.json({ data: { items, totalOutstandingPaise, totalOverduePaise } });
  } catch (err) {
    console.error('[accounts/receivables GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
