import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, or, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, projects, leads } from '@/lib/db/schema';
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
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)))
      .limit(1);

    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // All leads linked to this customer
    const customerLeads = await db
      .select({
        id:              leads.id,
        stage:           leads.stage,
        projectName:     leads.projectName,
        projectLocation: leads.projectLocation,
        budgetBand:      leads.budgetBand,
        source:          leads.source,
        createdAt:       leads.createdAt,
      })
      .from(leads)
      .where(and(eq(leads.customerId, id), eq(leads.tenantId, ctx.tenantId)));

    const allLeadIds = customerLeads.map(l => l.id);

    // Projects via customerId OR any of the customer's leadIds (handles projects
    // created before customerId was reliably set, and future edge cases)
    const projectCondition = allLeadIds.length > 0
      ? or(eq(projects.customerId, id), inArray(projects.leadId, allLeadIds))!
      : eq(projects.customerId, id);

    const linkedProjects = await db
      .select({
        id:                 projects.id,
        name:               projects.name,
        lifecycleStage:     projects.lifecycleStage,
        totalContractPaise: projects.totalContractPaise,
        leadId:             projects.leadId,
        createdAt:          projects.createdAt,
        siteAddress:        leads.projectLocation,
      })
      .from(projects)
      .leftJoin(leads, eq(projects.leadId, leads.id))
      .where(and(eq(projects.tenantId, ctx.tenantId), projectCondition))
      .limit(20);

    const totalContractPaise = linkedProjects.reduce(
      (acc, p) => acc + (p.totalContractPaise ?? 0),
      0,
    );

    // Active enquiries: leads not yet won or lost
    const activeLeads = customerLeads.filter(
      l => l.stage !== 'won' && l.stage !== 'lost',
    );

    return NextResponse.json({
      data: {
        projectCount: linkedProjects.length,
        totalContractPaise,
        projects: linkedProjects,
        leads: activeLeads,
      },
    });
  } catch (e) {
    console.error('[GET /api/v1/customers/:id/summary]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
