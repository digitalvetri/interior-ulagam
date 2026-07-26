import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, payments, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc, sql } from 'drizzle-orm';

// Reduce two aggregates in one round-trip:
//   totalPaise = subtotal + cgst + sgst + igst   (computed in SQL)
//   paidPaise  = sum(payments.amount) where status = 'captured'
// Client uses these to derive the paid/partial/pending badge without a
// second request.
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

    const paidPaiseExpr = sql<number>`
      COALESCE(SUM(CASE WHEN ${payments.status} = 'captured' THEN ${payments.amountPaise} ELSE 0 END), 0)::int
    `;
    const totalPaiseExpr = sql<number>`
      (${invoices.subtotalPaise} + ${invoices.cgstPaise} + ${invoices.sgstPaise} + ${invoices.igstPaise})::int
    `;

    const rows = await db
      .select({
        id: invoices.id,
        tenantId: invoices.tenantId,
        projectId: invoices.projectId,
        projectName: projects.name,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        subtotalPaise: invoices.subtotalPaise,
        cgstPaise: invoices.cgstPaise,
        sgstPaise: invoices.sgstPaise,
        igstPaise: invoices.igstPaise,
        totalPaise: totalPaiseExpr,
        paidPaise: paidPaiseExpr,
        placeOfSupply: invoices.placeOfSupply,
        isInterstate: invoices.isInterstate,
        irn: invoices.irn,
        qrCodeUrl: invoices.qrCodeUrl,
        pdfUrl: invoices.pdfUrl,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(payments, eq(payments.invoiceId, invoices.id))
      .where(and(...conditions))
      .groupBy(invoices.id, projects.name)
      .orderBy(desc(invoices.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[invoices GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
