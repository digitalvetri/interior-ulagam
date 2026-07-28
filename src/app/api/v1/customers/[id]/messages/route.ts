import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, waMessages } from '@/lib/db/schema';
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
