import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { invoices, milestones, projects, payments, customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc, count, ne, inArray, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    // Derive payment status from payments table for invoices without a milestone link
    const invoiceIds = rows.map(r => r.id);
    const paymentSumsMap = new Map<string, number>();
    if (invoiceIds.length > 0) {
      const sums = await db
        .select({
          invoiceId: payments.invoiceId,
          total: sql<number>`sum(${payments.amountPaise})`.mapWith(Number),
        })
        .from(payments)
        .where(and(inArray(payments.invoiceId, invoiceIds), ne(payments.status, 'pending')))
        .groupBy(payments.invoiceId);
      for (const s of sums) {
        if (s.invoiceId) paymentSumsMap.set(s.invoiceId, s.total);
      }
    }

    const enriched = rows.map(r => {
      let paymentStatus: string = r.milestonePaymentStatus ?? 'pending';
      if (!r.milestonePaymentStatus) {
        const totalInvoicePaise = r.subtotalPaise + r.cgstPaise + r.sgstPaise + r.igstPaise;
        const paidPaise = paymentSumsMap.get(r.id) ?? 0;
        paymentStatus = paidPaise >= totalInvoicePaise && totalInvoicePaise > 0
          ? 'paid' : paidPaise > 0 ? 'partial' : 'pending';
      }
      const { milestonePaymentStatus: _, ...rest } = r;
      return { ...rest, paymentStatus };
    });

    return NextResponse.json({ data: enriched });
  } catch (err) {
    console.error('[invoices GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const CreateSchema = z.object({
  projectId:     z.string().uuid(),
  milestoneId:   z.string().uuid().optional(),
  invoiceNumber: z.string().min(1).max(100).optional(),
  invoiceDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subtotalPaise: z.number().int().nonnegative(),
  isInterstate:  z.boolean().default(false),
  placeOfSupply: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const p = parsed.data;

  // Verify project belongs to tenant
  const [proj] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, p.projectId), eq(projects.tenantId, ctx.tenantId)));

  if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Auto-generate invoice number if not provided (INV-YYYY-NNNN)
  let invoiceNumber = p.invoiceNumber?.trim();
  if (!invoiceNumber) {
    const [{ value: invoiceCount }] = await db
      .select({ value: count() })
      .from(invoices)
      .where(eq(invoices.tenantId, ctx.tenantId));
    const year = new Date().getFullYear();
    invoiceNumber = `INV-${year}-${String(Number(invoiceCount) + 1).padStart(4, '0')}`;
  }

  // GST — mirror milestone trigger convention
  const subtotalPaise = p.subtotalPaise;
  const igstPaise  = p.isInterstate ? Math.round(subtotalPaise * 0.18) : 0;
  const cgstPaise  = p.isInterstate ? 0 : Math.round(subtotalPaise * 0.09);
  const sgstPaise  = p.isInterstate ? 0 : Math.round(subtotalPaise * 0.09);

  try {
    const [invoice] = await db
      .insert(invoices)
      .values({
        tenantId:      ctx.tenantId,
        projectId:     p.projectId,
        invoiceNumber,
        invoiceDate:   p.invoiceDate,
        subtotalPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
        isInterstate:  p.isInterstate,
        placeOfSupply: p.placeOfSupply ?? null,
      })
      .returning();

    // Link milestone if provided
    if (p.milestoneId && invoice) {
      await db
        .update(milestones)
        .set({ invoiceId: invoice.id })
        .where(and(
          eq(milestones.id, p.milestoneId),
          eq(milestones.projectId, p.projectId),
        ));
    }

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (err) {
    console.error('[invoices POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
