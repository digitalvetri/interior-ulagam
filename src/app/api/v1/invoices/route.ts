import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { invoices, milestones, projects, payments, customers } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, desc, ne, inArray, sql } from 'drizzle-orm';
import { splitGst } from '@/lib/finance/gst';
import { nextInvoiceNumber } from '@/lib/finance/invoice-number';
import { isUniqueViolation, retryOnUniqueViolation } from '@/lib/finance/receipt-number';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Invoices — finance roles, matching the Invoices menu.
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  try {
    const conditions = [eq(invoices.tenantId, ctx.tenantId)];
    if (projectId) {
      conditions.push(eq(invoices.projectId, projectId));
    }

    const rows = await db
      .select({
        id: invoices.id,
        tenantId: invoices.tenantId,
        projectId: invoices.projectId,
        projectName: projects.name,
        clientName:  customers.fullName,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        status: invoices.status,
        notes: invoices.notes,
        subtotalPaise: invoices.subtotalPaise,
        cgstPaise: invoices.cgstPaise,
        sgstPaise: invoices.sgstPaise,
        igstPaise: invoices.igstPaise,
        placeOfSupply: invoices.placeOfSupply,
        isInterstate: invoices.isInterstate,
        irn: invoices.irn,
        qrCodeUrl: invoices.qrCodeUrl,
        pdfUrl: invoices.pdfUrl,
        createdAt: invoices.createdAt,
        milestonePaymentStatus: milestones.paymentStatus,
      })
      .from(invoices)
      .innerJoin(projects,  eq(invoices.projectId,    projects.id))
      .leftJoin(customers,  eq(projects.customerId,   customers.id))
      .leftJoin(milestones, eq(milestones.invoiceId,  invoices.id))
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt));

    // Compute paid amount from payments table for each invoice
    const invoiceIds = rows.map(r => r.id);
    const paymentSumsMap = new Map<string, number>();
    if (invoiceIds.length > 0) {
      const sums = await db
        .select({
          invoiceId: payments.invoiceId,
          total: sql<number>`sum(${payments.amountPaise})`.mapWith(Number),
        })
        .from(payments)
        .where(and(eq(payments.tenantId, ctx.tenantId), inArray(payments.invoiceId, invoiceIds), ne(payments.status, 'pending')))
        .groupBy(payments.invoiceId);
      for (const s of sums) {
        if (s.invoiceId) paymentSumsMap.set(s.invoiceId, s.total);
      }
    }

    const enriched = rows.map(r => {
      const paidPaise = paymentSumsMap.get(r.id) ?? 0;
      // Use invoices.status as the source of truth — it is kept in sync by the
      // payment handler. milestone.paymentStatus lags behind when payments are
      // recorded directly against the invoice rather than through a milestone trigger.
      let paymentStatus: string;
      if (r.status === 'paid')      paymentStatus = 'paid';
      else if (r.status === 'part_paid') paymentStatus = 'partial';
      else if (r.status === 'void') paymentStatus = 'overdue';
      else {
        // draft / issued — derive from actual payments
        const totalInvoicePaise = r.subtotalPaise + r.cgstPaise + r.sgstPaise + r.igstPaise;
        paymentStatus = paidPaise >= totalInvoicePaise && totalInvoicePaise > 0
          ? 'paid' : paidPaise > 0 ? 'partial' : 'pending';
      }
      const { milestonePaymentStatus: _, ...rest } = r;
      return { ...rest, paymentStatus, paidPaise };
    });

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error('[invoices GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Per-line tax is always recomputed here from the project's GST rate; any tax
// figures the client sends on a line are ignored.
const HsnSacLineSchema = z.object({
  hsnSac:      z.string().max(20).optional(),
  description: z.string().max(500),
  amountPaise: z.number().int().nonnegative(),
});

const CreateSchema = z.object({
  projectId:       z.string().uuid(),
  milestoneId:     z.string().uuid().optional(),
  invoiceNumber:   z.string().min(1).max(100).optional(),
  invoiceDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  subtotalPaise:   z.number().int().nonnegative(),
  isInterstate:    z.boolean().default(false),
  noGst:           z.boolean().default(false),
  placeOfSupply:   z.string().max(100).optional(),
  hsnSacLinesJson: z.array(HsnSacLineSchema).optional(),
  notes:           z.string().max(2000).optional(),
  status:          z.enum(['draft', 'issued']).optional(),
});

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const p = parsed.data;

  try {
    // Verify project belongs to tenant; its GST rate drives the tax.
    const [proj] = await db
      .select({ id: projects.id, gstPct: projects.gstPct })
      .from(projects)
      .where(and(eq(projects.id, p.projectId), eq(projects.tenantId, ctx.tenantId)));

    if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    if (p.milestoneId) {
      const [ms] = await db.select({ id: milestones.id, invoiceId: milestones.invoiceId }).from(milestones)
        .where(and(eq(milestones.id, p.milestoneId), eq(milestones.projectId, p.projectId), eq(milestones.tenantId, ctx.tenantId)))
        .limit(1);
      if (!ms) return NextResponse.json({ error: 'Milestone not found on this project' }, { status: 404 });
      if (ms.invoiceId) return NextResponse.json({ error: 'That milestone already has an invoice.' }, { status: 409 });
    }

    // GST — per line when lines are given (invoice tax = sum of line tax), else on the subtotal.
    const gstOpts = { isInterstate: p.isInterstate, noGst: p.noGst };
    const lines = (p.hsnSacLinesJson ?? []).map(l => ({ ...l, hsnSac: l.hsnSac ?? '9954', ...splitGst(l.amountPaise, proj.gstPct, gstOpts) }));
    if (lines.length && lines.reduce((s, l) => s + l.amountPaise, 0) !== p.subtotalPaise) {
      return NextResponse.json({ error: 'Line amounts must add up to the subtotal.' }, { status: 422 });
    }
    const subtotalPaise = p.subtotalPaise;
    const tax = lines.length
      ? lines.reduce((t, l) => ({ cgstPaise: t.cgstPaise + l.cgstPaise, sgstPaise: t.sgstPaise + l.sgstPaise, igstPaise: t.igstPaise + l.igstPaise }),
        { cgstPaise: 0, sgstPaise: 0, igstPaise: 0 })
      : splitGst(subtotalPaise, proj.gstPct, gstOpts);
    const typedNumber = p.invoiceNumber?.trim();

    const invoice = await retryOnUniqueViolation(() => db.transaction(async (tx) => {
      // Auto-number when not typed (INV-YYYY-NNNN, one above the highest this year).
      const invoiceNumber = typedNumber || await nextInvoiceNumber(tx, ctx.tenantId);
      const [row] = await tx
        .insert(invoices)
        .values({
          tenantId:        ctx.tenantId,
          projectId:       p.projectId,
          invoiceNumber,
          invoiceDate:     p.invoiceDate,
          dueDate:         p.dueDate ?? null,
          subtotalPaise,
          ...tax,
          isInterstate:    p.isInterstate,
          placeOfSupply:   p.placeOfSupply ?? null,
          hsnSacLinesJson: lines,
          notes:           p.notes ?? null,
          status:          p.status ?? 'draft',
          issuedAt:        p.status === 'issued' ? new Date() : null,
        })
        .returning();
      if (p.milestoneId) {
        await tx.update(milestones).set({ invoiceId: row.id })
          .where(and(eq(milestones.id, p.milestoneId), eq(milestones.projectId, p.projectId), eq(milestones.tenantId, ctx.tenantId)));
      }
      return row;
    }), typedNumber ? 1 : 4).catch((err: unknown) => {
      if (typedNumber && isUniqueViolation(err)) return null;
      throw err;
    });
    if (!invoice) {
      return NextResponse.json({ error: `Invoice number ${typedNumber} is already used.` }, { status: 409 });
    }

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (err) {
    console.error('[invoices POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
