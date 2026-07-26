import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { payments, invoices, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  try {
    if (projectId) {
      // Filter payments by projectId via join: payments → invoices → projects
      const rows = await db
        .select({
          id: payments.id,
          tenantId: payments.tenantId,
          invoiceId: payments.invoiceId,
          razorpayLinkId: payments.razorpayLinkId,
          razorpayPaymentId: payments.razorpayPaymentId,
          amountPaise: payments.amountPaise,
          status: payments.status,
          reconciledAt: payments.reconciledAt,
          manualOverrideBy: payments.manualOverrideBy,
          manualOverrideNote: payments.manualOverrideNote,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .innerJoin(projects, eq(invoices.projectId, projects.id))
        .where(
          and(
            eq(payments.tenantId, ctx.tenantId),
            eq(projects.id, projectId),
          ),
        )
        .orderBy(desc(payments.createdAt));

      return NextResponse.json({ data: rows });
    }

    // All payments for tenant
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.tenantId, ctx.tenantId))
      .orderBy(desc(payments.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[payments GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
