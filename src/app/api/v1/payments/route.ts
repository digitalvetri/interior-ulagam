import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { payments, invoices, projects, customers } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, desc, sql } from 'drizzle-orm';
import { recordClientPayment } from '@/lib/finance/payments-server';

const PAYMENT_MODES = ['upi', 'cash', 'bank', 'cheque', 'card', 'razorpay'] as const;

const CreatePaymentSchema = z.object({
  amountPaise:  z.number().int().positive(),
  mode:         z.enum(PAYMENT_MODES),
  reference:    z.string().max(200).optional(),
  receivedAt:   z.string().datetime().optional(), // ISO; defaults to now
  note:         z.string().max(500).optional(),
  invoiceId:    z.string().uuid().optional().nullable(),
  projectId:    z.string().uuid().optional().nullable(),
  customerId:   z.string().uuid().optional().nullable(),
  /** Split across milestones explicitly; otherwise the oldest due milestones are paid first. */
  allocations:  z.array(z.object({ milestoneId: z.string().uuid(), amountPaise: z.number().int().positive() })).max(20).optional(),
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Client payments — finance roles, matching the Accounts menu.
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const projectIdParam = searchParams.get('projectId');
  const limitParam     = searchParams.get('limit');
  const limit          = Math.min(parseInt(limitParam ?? '500', 10) || 500, 1000);

  const COLS = {
    id:            payments.id,
    receiptNumber: payments.receiptNumber,
    receivedAt:    payments.receivedAt,
    createdAt:     payments.createdAt,
    amountPaise:   payments.amountPaise,
    status:        payments.status,
    mode:          payments.mode,
    reference:     payments.reference,
    note:          payments.note,
    invoiceId:     payments.invoiceId,
    projectId:     payments.projectId,
    customerId:    payments.customerId,
    invoiceNumber: invoices.invoiceNumber,
    projectName:   projects.name,
    clientName:    customers.fullName,
  };

  try {
    if (projectIdParam) {
      // Project-scoped: payments whose invoice belongs to this project, or direct projectId match
      const rows = await db
        .select(COLS)
        .from(payments)
        .leftJoin(invoices,  eq(payments.invoiceId, invoices.id))
        .leftJoin(projects,  sql`COALESCE(${invoices.projectId}, ${payments.projectId}) = ${projects.id}`)
        .leftJoin(customers, sql`COALESCE(${projects.customerId}, ${payments.customerId}) = ${customers.id}`)
        .where(and(
          eq(payments.tenantId, ctx.tenantId),
          sql`COALESCE(${invoices.projectId}, ${payments.projectId}) = ${projectIdParam}::uuid`,
        ))
        .orderBy(desc(payments.createdAt));
      return NextResponse.json({ data: rows });
    }

    // All payments for tenant — enriched with client/project/invoice names
    const q = db
      .select(COLS)
      .from(payments)
      .leftJoin(invoices,  eq(payments.invoiceId, invoices.id))
      .leftJoin(projects,  sql`COALESCE(${invoices.projectId}, ${payments.projectId}) = ${projects.id}`)
      .leftJoin(customers, sql`COALESCE(${projects.customerId}, ${payments.customerId}) = ${customers.id}`)
      .where(eq(payments.tenantId, ctx.tenantId))
      .orderBy(desc(payments.createdAt));

    const rows = await q.limit(limit);
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[payments GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = CreatePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const d = parsed.data;

  try {
    const result = await recordClientPayment(ctx.tenantId, ctx.userId, {
      ...d,
      receivedAt: d.receivedAt ? new Date(d.receivedAt) : undefined,
      // Every receipt must land on a project (directly or via its invoice) or at least a client.
      requireProject: !d.customerId,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    const { payment, allocatedPaise, advancePaise } = result;
    return NextResponse.json({ data: { ...payment, allocatedPaise, advancePaise } }, { status: 201 });
  } catch (err) {
    console.error('[payments POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
