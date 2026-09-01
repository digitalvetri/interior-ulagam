import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { milestones, projects, leads, customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp/send';
import { formatRupees } from '@/lib/utils';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
): Promise<NextResponse> {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId, milestoneId } = await params;

  // Verify milestone belongs to this project + tenant
  const [row] = await db
    .select({
      milestoneId:    milestones.id,
      label:          milestones.label,
      amountPaise:    milestones.amountPaise,
      paymentStatus:  milestones.paymentStatus,
      tenantId:       projects.tenantId,
      contactPhone:   leads.contactPhone,
      customerPhone:  customers.phone,
      contactName:    leads.contactName,
      customerName:   customers.fullName,
    })
    .from(milestones)
    .innerJoin(projects, eq(milestones.projectId, projects.id))
    .leftJoin(leads, eq(projects.leadId, leads.id))
    .leftJoin(customers, eq(projects.customerId, customers.id))
    .where(
      and(
        eq(milestones.id, milestoneId),
        eq(milestones.projectId, projectId),
        eq(projects.tenantId, ctx.tenantId),
      )
    )
    .limit(1);

  if (!row) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
  if (row.paymentStatus === 'paid') {
    return NextResponse.json({ error: 'Milestone is already paid' }, { status: 400 });
  }

  const phone = row.contactPhone ?? row.customerPhone;
  if (!phone) {
    return NextResponse.json({ error: 'No client phone number on record' }, { status: 422 });
  }

  const clientName = row.contactName ?? row.customerName ?? 'Valued Client';

  try {
    await whatsapp.send({
      type: 'template',
      to: phone,
      templateName: 'payment_reminder_en',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: clientName },
            { type: 'text', text: row.label },
            { type: 'text', text: formatRupees(row.amountPaise) },
          ],
        },
      ],
    });
    return NextResponse.json({ message: 'Reminder sent' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[milestone remind]', msg);
    return NextResponse.json({ error: `WhatsApp send failed: ${msg}` }, { status: 502 });
  }
}
