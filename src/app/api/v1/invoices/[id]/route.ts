import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, payments, projects, milestones, customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, ne } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)));

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const [invoicePayments, projectRow, milestoneRow] = await Promise.all([
      db.select().from(payments)
        .where(and(eq(payments.invoiceId, id), eq(payments.tenantId, ctx.tenantId))),
      db.select({ id: projects.id, name: projects.name, clientName: customers.fullName })
        .from(projects)
        .leftJoin(customers, eq(projects.customerId, customers.id))
        .where(eq(projects.id, invoice.projectId)),
      db.select({ id: milestones.id, projectId: milestones.projectId, label: milestones.label })
        .from(milestones)
        .where(eq(milestones.invoiceId, id)),
    ]);

    return NextResponse.json({
      data: {
        invoice: { ...invoice, projectName: projectRow[0]?.name ?? null },
        payments: invoicePayments,
        project: projectRow[0] ?? null,
        sourceMilestone: milestoneRow[0] ?? null,
      },
    });
  } catch (err) {
    console.error('[invoices/:id GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/v1/invoices/[id]
// Edit a DRAFT invoice. Issued/paid/void invoices cannot be edited.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [invoice] = await db
    .select({ id: invoices.id, status: invoices.status })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)))
    .limit(1);

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (invoice.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft invoices can be edited.' },
      { status: 409 },
    );
  }

  const body = await request.json() as {
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate?: string | null;
    subtotalPaise?: number;
    isInterstate?: boolean;
    noGst?: boolean;
    placeOfSupply?: string | null;
  };

  // Resolve tax fields — fetch current subtotal if only GST type is changing
  let sub = body.subtotalPaise;
  if (sub === undefined && (body.isInterstate !== undefined || body.noGst !== undefined)) {
    const [cur] = await db
      .select({ subtotalPaise: invoices.subtotalPaise })
      .from(invoices).where(eq(invoices.id, id)).limit(1);
    sub = cur?.subtotalPaise;
  }

  const noG  = body.noGst ?? false;
  const isIS = !noG && ((body.isInterstate) ?? false);

  const taxFields = sub !== undefined ? {
    subtotalPaise: sub,
    isInterstate:  isIS,
    cgstPaise:     noG || isIS ? 0 : Math.round(sub * 0.09),
    sgstPaise:     noG || isIS ? 0 : Math.round(sub * 0.09),
    igstPaise:     isIS ? Math.round(sub * 0.18) : 0,
  } : {};

  const patch = {
    ...(body.invoiceNumber !== undefined && { invoiceNumber: body.invoiceNumber }),
    ...(body.invoiceDate   !== undefined && { invoiceDate:   body.invoiceDate }),
    ...(body.dueDate       !== undefined && { dueDate:       body.dueDate }),
    ...(body.placeOfSupply !== undefined && { placeOfSupply: body.placeOfSupply }),
    ...taxFields,
  };

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    await db.update(invoices).set(patch).where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)));
    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error('[invoices/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v1/invoices/[id]
// Only draft or void invoices with no captured payments can be deleted.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const [invoice] = await db
      .select({ id: invoices.id, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)))
      .limit(1);

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    if (invoice.status !== 'draft' && invoice.status !== 'void') {
      return NextResponse.json(
        { error: 'Only draft or void invoices can be deleted. Void the invoice first.' },
        { status: 409 },
      );
    }

    const [capturedPayment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.invoiceId, id), ne(payments.status, 'pending')))
      .limit(1);

    if (capturedPayment) {
      return NextResponse.json(
        { error: 'Cannot delete an invoice that has recorded payments.' },
        { status: 409 },
      );
    }

    await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)));

    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error('[invoices/:id DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
