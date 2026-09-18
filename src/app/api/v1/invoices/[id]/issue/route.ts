import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { invoices } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { DEFAULT_INVOICE_DUE_DAYS } from '@/lib/finance/constants';

const IssueSchema = z.object({
  dueDate: z.string().optional(), // ISO date; defaults to today + DEFAULT_INVOICE_DUE_DAYS
});

// POST /api/v1/invoices/[id]/issue
// Transitions invoice from draft → issued, sets issuedAt and dueDate.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: unknown = {};
  try { body = await request.json(); } catch { /* no body is fine */ }

  const parsed = IssueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const [existing] = await db.select({ status: invoices.status, tenantId: invoices.tenantId })
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status !== 'draft') {
      return NextResponse.json({ error: `Cannot issue an invoice in status: ${existing.status}` }, { status: 409 });
    }

    const now = new Date();
    const dueDateStr = parsed.data.dueDate
      ?? new Date(now.getTime() + DEFAULT_INVOICE_DUE_DAYS * 86400000).toISOString().split('T')[0];

    const [updated] = await db.update(invoices)
      .set({ status: 'issued', issuedAt: now, dueDate: dueDateStr })
      .where(eq(invoices.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[POST /api/v1/invoices/[id]/issue]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
