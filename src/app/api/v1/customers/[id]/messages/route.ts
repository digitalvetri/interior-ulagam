import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customerActivities, customers, waMessages } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp/send';

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
      .select({ phone: customers.phone })
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)))
      .limit(1);

    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const messages = await db
      .select({
        id:          waMessages.id,
        direction:   waMessages.direction,
        bodyPreview: waMessages.bodyPreview,
        templateName: waMessages.templateName,
        category:    waMessages.category,
        createdAt:   waMessages.createdAt,
      })
      .from(waMessages)
      .where(
        and(
          eq(waMessages.tenantId, ctx.tenantId),
          eq(waMessages.threadId, customer.phone),
        ),
      )
      .orderBy(desc(waMessages.createdAt))
      .limit(30);

    return NextResponse.json({ data: messages, phone: customer.phone });
  } catch (e) {
    console.error('[GET /api/v1/customers/:id/messages]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const SendSchema = z.object({
  text: z.string().min(1).max(4096),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 422 });

  try {
    const [customer] = await db
      .select({ phone: customers.phone, fullName: customers.fullName, tenantId: customers.tenantId })
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)))
      .limit(1);

    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { messageId } = await whatsapp.send({
      type: 'text',
      to: customer.phone,
      text: parsed.data.text,
    });

    // Persist to wa_messages so it appears in the thread
    const [saved] = await db
      .insert(waMessages)
      .values({
        tenantId:      ctx.tenantId,
        threadId:      customer.phone,
        metaMessageId: messageId || null,
        direction:     'outbound',
        category:      'utility',
        bodyPreview:   parsed.data.text.slice(0, 280),
      })
      .returning({
        id:          waMessages.id,
        direction:   waMessages.direction,
        bodyPreview: waMessages.bodyPreview,
        templateName: waMessages.templateName,
        category:    waMessages.category,
        createdAt:   waMessages.createdAt,
      });

    // Log as activity so timeline stays in sync
    await db.insert(customerActivities).values({
      tenantId:   ctx.tenantId,
      customerId: id,
      type:       'whatsapp',
      title:      `WhatsApp sent`,
      body:       parsed.data.text.slice(0, 500),
      performedBy: ctx.userId,
    });

    return NextResponse.json({ data: saved }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/customers/:id/messages]', e);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
