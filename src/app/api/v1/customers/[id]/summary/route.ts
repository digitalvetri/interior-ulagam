import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const [customer] = await db
      .select({ id: customers.id, leadId: customers.leadId })
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)))
      .limit(1);

    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Match projects by customerId, and also by leadId if the customer is linked to a lead
    const projectCondition = customer.leadId
      ? or(eq(projects.customerId, id), eq(projects.leadId, customer.leadId))!
      : eq(projects.customerId, id);

    const linkedProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        lifecycleStage: projects.lifecycleStage,
        totalContractPaise: projects.totalContractPaise,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(and(eq(projects.tenantId, ctx.tenantId), projectCondition))
      .limit(20);

    const totalContractPaise = linkedProjects.reduce(
      (acc, p) => acc + (p.totalContractPaise ?? 0),
      0,
    );

    return NextResponse.json({
      data: {
        projectCount: linkedProjects.length,
        totalContractPaise,
        projects: linkedProjects,
      },
    });
  } catch (e) {
    console.error('[GET /api/v1/customers/:id/summary]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
