import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { recordClientPayment } from '@/lib/finance/payments-server';

// Manual payment against one invoice (cash, cheque, bank transfer confirmed by
// hand). Same rules as POST /api/v1/payments: receipt number, project + client,
// milestone allocation, invoice status sync; void invoices are rejected.
const RecordManualPaymentSchema = z.object({
  amountPaise: z.number().int().positive().max(1_000_000_00_000), // ₹10 Cr cap
  mode:        z.enum(['upi', 'cash', 'bank', 'cheque', 'card', 'razorpay']),
  reference:   z.string().max(200).optional(),
  receivedAt:  z.string().datetime().optional(),
  note:        z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RecordManualPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }
  const d = parsed.data;

  try {
    const result = await recordClientPayment(ctx.tenantId, ctx.userId, {
      ...d,
      invoiceId: id,
      receivedAt: d.receivedAt ? new Date(d.receivedAt) : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const { payment, allocatedPaise, advancePaise } = result;
    return NextResponse.json({ data: { ...payment, allocatedPaise, advancePaise } }, { status: 201 });
  } catch (err) {
    console.error('[invoices/:id/payments POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
