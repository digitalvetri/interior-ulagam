import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, payments, projects, milestones, customers } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { z } from 'zod';
import { eq, and, ne, isNotNull } from 'drizzle-orm';
import { splitGst } from '@/lib/finance/gst';
import { isUniqueViolation } from '@/lib/finance/receipt-number';

const PatchSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(100).optional(),
  invoiceDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  subtotalPaise: z.number().int().nonnegative().optional(),
  isInterstate:  z.boolean().optional(),
  noGst:         z.boolean().optional(),
  placeOfSupply: z.string().max(100).nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Invoices — finance roles, matching the Invoices menu.
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

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
      db.select({ id: projects.id, name: projects.name, clientName: customers.fullName, clientPhone: customers.phone })
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
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  const { id } = await params;

  let rawBody: unknown;
  try { rawBody = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }
  const body = parsed.data;

  const [invoice] = await db
    .select({
      id: invoices.id, status: invoices.status, subtotalPaise: invoices.subtotalPaise, isInterstate: invoices.isInterstate,
      cgstPaise: invoices.cgstPaise, sgstPaise: invoices.sgstPaise, igstPaise: invoices.igstPaise,
      lines: invoices.hsnSacLinesJson, gstPct: projects.gstPct,
    })
    .from(invoices)
    .innerJoin(projects, eq(projects.id, invoices.projectId))
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)))
    .limit(1);

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (invoice.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft invoices can be edited.' },
      { status: 409 },
    );
  }

  // Tax follows the project's GST rate. Unchanged fields keep their current values.
  const taxChanging = body.subtotalPaise !== undefined || body.isInterstate !== undefined || body.noGst !== undefined;
  const sub = body.subtotalPaise ?? invoice.subtotalPaise;
  const wasNoGst = invoice.cgstPaise + invoice.sgstPaise + invoice.igstPaise === 0;
  const noG  = body.noGst ?? wasNoGst;
  const isIS = !noG && (body.isInterstate ?? invoice.isInterstate);
  const split = splitGst(sub, invoice.gstPct, { isInterstate: isIS, noGst: noG });
  // Stored lines that no longer add up to the subtotal are dropped (the PDF rebuilds one line from the totals).
  const storedLines = Array.isArray(invoice.lines) ? (invoice.lines as { amountPaise?: number }[]) : [];
  const linesStale = storedLines.length > 0 && storedLines.reduce((s, l) => s + (Number(l.amountPaise) || 0), 0) !== sub;

  const taxFields = taxChanging ? {
    subtotalPaise: sub,
    isInterstate:  isIS,
    ...split,
    ...(linesStale ? { hsnSacLinesJson: [] } : {}),
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
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'That invoice number is already used.' }, { status: 409 });
    }
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
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

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
      .where(and(eq(payments.tenantId, ctx.tenantId), eq(payments.invoiceId, id), ne(payments.status, 'pending')))
      .limit(1);

    if (capturedPayment) {
      return NextResponse.json(
        { error: 'Cannot delete an invoice that has recorded payments.' },
        { status: 409 },
      );
    }

    const [liveLink] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.tenantId, ctx.tenantId), eq(payments.invoiceId, id), eq(payments.status, 'pending'), isNotNull(payments.razorpayLinkId)))
      .limit(1);
    if (liveLink) {
      return NextResponse.json(
        { error: 'A payment link is still open for this invoice. Mark the milestone paid or resend the link before deleting.' },
        { status: 409 },
      );
    }

    // Unlink any milestone first (milestones.invoice_id has no ON DELETE action).
    await db.transaction(async (tx) => {
      await tx.update(milestones).set({ invoiceId: null })
        .where(and(eq(milestones.tenantId, ctx.tenantId), eq(milestones.invoiceId, id)));
      await tx.delete(payments)
        .where(and(eq(payments.tenantId, ctx.tenantId), eq(payments.invoiceId, id), eq(payments.status, 'pending')));
      await tx.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, ctx.tenantId)));
    });

    return NextResponse.json({ data: { id } });
  } catch (err) {
    console.error('[invoices/:id DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
