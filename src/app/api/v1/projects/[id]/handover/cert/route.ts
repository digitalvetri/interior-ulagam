import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, tenants, customers, snagItems, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { extractBranding } from '@/lib/pdf/branding';
import { renderHandoverCertPdf } from '@/lib/pdf/handover-cert';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [project] = await db
    .select({
      id:             projects.id,
      name:           projects.name,
      lifecycleStage: projects.lifecycleStage,
      customerId:     projects.customerId,
      leadId:         projects.leadId,
      startedAt:      projects.startedAt,
      expectedEndAt:  projects.expectedEndAt,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)))
    .limit(1);

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  if (!['handover', 'complete'].includes(project.lifecycleStage)) {
    return NextResponse.json(
      { error: 'Handover certificate is only available after handover is initiated' },
      { status: 422 },
    );
  }

  const [tenant] = await db
    .select({ name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
    .from(tenants)
    .where(eq(tenants.id, ctx.tenantId))
    .limit(1);

  // Resolve client name + phone
  let clientName = 'Valued Client';
  let clientPhone: string | null = null;

  if (project.customerId) {
    const [customer] = await db
      .select({ fullName: customers.fullName, phone: customers.phone })
      .from(customers)
      .where(eq(customers.id, project.customerId))
      .limit(1);
    if (customer) { clientName = customer.fullName; clientPhone = customer.phone; }
  } else if (project.leadId) {
    const [lead] = await db
      .select({ contactName: leads.contactName, contactPhone: leads.contactPhone })
      .from(leads)
      .where(eq(leads.id, project.leadId))
      .limit(1);
    if (lead) { clientName = lead.contactName; clientPhone = lead.contactPhone; }
  }

  const resolvedSnags = await db
    .select({ description: snagItems.description, status: snagItems.status, clientConfirmedAt: snagItems.clientConfirmedAt })
    .from(snagItems)
    .where(and(
      eq(snagItems.projectId, id),
      inArray(snagItems.status, ['resolved', 'client_confirmed']),
    ))
    .orderBy(asc(snagItems.createdAt));

  const studio = extractBranding(tenant ?? { name: 'Interior Studio' });
  const docNumber = `HC-${id.slice(-6).toUpperCase()}`;

  try {
    const buf = await renderHandoverCertPdf({
      docNumber,
      handoverDate: new Date(),
      studio,
      project: {
        name:          project.name,
        startedAt:     project.startedAt?.toISOString() ?? null,
        expectedEndAt: project.expectedEndAt?.toISOString() ?? null,
      },
      client: { name: clientName, phone: clientPhone },
      snagItems: resolvedSnags.map(s => ({
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
      },
    });
  } catch (err) {
    console.error('[handover/cert GET]', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
