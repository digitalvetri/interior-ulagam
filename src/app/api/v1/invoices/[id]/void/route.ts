import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const VoidSchema = z.object({
  voidReason: z.string().min(1).max(500),
});

// POST /api/v1/invoices/[id]/void
// Transitions invoice to void. Only draft or issued invoices can be voided.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = VoidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const [existing] = await db.select({ status: invoices.status, tenantId: invoices.tenantId })
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === 'paid' || existing.status === 'part_paid') {
      return NextResponse.json({ error: 'Cannot void an invoice with captured payments. Record a refund first.' }, { status: 409 });
    }
    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Invoice is already void' }, { status: 409 });
    }

    const [updated] = await db.update(invoices)
      .set({ status: 'void', voidedAt: new Date(), voidReason: parsed.data.voidReason })
      .where(eq(invoices.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[POST /api/v1/invoices/[id]/void]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
