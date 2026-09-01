import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// ─── POST /api/v1/leads/[id]/convert-to-customer ────────────────────────────
// Creates a customer from the lead's contact data, sets customers.leadId, and
// updates leads.customerId — atomic from the caller's perspective.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const [lead] = await db
      .select({
        id: leads.id,
        tenantId: leads.tenantId,
        contactName: leads.contactName,
        contactPhone: leads.contactPhone,
        contactEmail: leads.contactEmail,
        contactCity: leads.contactCity,
        source: leads.source,
        customerId: leads.customerId,
      })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Already converted — return existing id, not an error.
    if (lead.customerId) {
      return NextResponse.json({ data: { customerId: lead.customerId }, message: 'Already a customer' });
    }

    const [newCustomer] = await db
      .insert(customers)
      .values({
        tenantId: ctx.tenantId,
        fullName: lead.contactName,
        phone: lead.contactPhone,
        email: lead.contactEmail ?? undefined,
        city: lead.contactCity ?? undefined,
        source: lead.source as 'referral' | 'instagram' | 'whatsapp' | 'website' | 'walk_in' | 'other',
        stage: 'opportunity',
        leadId: lead.id,
      })
      .returning({ id: customers.id });

    if (!newCustomer) {
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }

    await db
      .update(leads)
      .set({ customerId: newCustomer.id })
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)));

    return NextResponse.json(
      { data: { customerId: newCustomer.id }, message: 'Converted to customer' },
      { status: 201 },
    );
  } catch (e) {
    console.error('[POST /api/v1/leads/[id]/convert-to-customer]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
