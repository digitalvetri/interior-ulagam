import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, snagItems, customers, leads, tenants } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { extractBranding } from '@/lib/pdf/branding';
import { renderHandoverCertPdf } from '@/lib/pdf/handover-cert';

// GET /api/v1/projects/[id]/handover/cert — generate and stream handover certificate PDF
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;

  try {
    const [project] = await db
      .select({
        id:            projects.id,
        name:          projects.name,
        startedAt:     projects.startedAt,
        expectedEndAt: projects.expectedEndAt,
        customerId:    projects.customerId,
        leadId:        projects.leadId,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)))
      .limit(1);

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    let clientName = 'Client';
    let clientPhone: string | null = null;

    if (project.customerId) {
      const [customer] = await db
        .select({ fullName: customers.fullName, phone: customers.phone })
        .from(customers)
        .where(and(eq(customers.id, project.customerId), eq(customers.tenantId, ctx.tenantId)))
        .limit(1);
      if (customer) { clientName = customer.fullName; clientPhone = customer.phone; }
    } else if (project.leadId) {
      const [lead] = await db
        .select({ contactName: leads.contactName, contactPhone: leads.contactPhone })
        .from(leads)
        .where(and(eq(leads.id, project.leadId), eq(leads.tenantId, ctx.tenantId)))
        .limit(1);
      if (lead) { clientName = lead.contactName; clientPhone = lead.contactPhone; }
    }

    const snags = await db
      .select({
        description:       snagItems.description,
        status:            snagItems.status,
        clientConfirmedAt: snagItems.clientConfirmedAt,
      })
      .from(snagItems)
      .where(and(
        eq(snagItems.projectId, projectId),
        inArray(snagItems.status, ['resolved', 'client_confirmed']),
      ));

    const [tenant] = await db
      .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    const studio = extractBranding(tenant ?? { name: 'Konst Design' });
    const docNumber = `HC-${projectId.slice(-6).toUpperCase()}`;

    const buf = await renderHandoverCertPdf({
      docNumber,
      handoverDate: new Date(),
      studio,
      project: {
        name:          project.name,
        startedAt:     project.startedAt?.toISOString() ?? null,
        expectedEndAt: project.expectedEndAt?.toISOString() ?? null,
      },
      client: { name: clientName, phone: clientPhone ?? undefined },
      snagItems: snags.map(s => ({
        description:       s.description,
        status:            s.status as 'resolved' | 'client_confirmed',
        clientConfirmedAt: s.clientConfirmedAt?.toISOString() ?? null,
      })),
    });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${docNumber}.pdf"`,
        'Content-Length':      String(buf.length),
        'Cache-Control':       'no-store',
      },
    });
  } catch (err) {
    console.error('[projects/:id/handover/cert GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
