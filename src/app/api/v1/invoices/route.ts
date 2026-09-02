import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, milestones, projects } from '@/lib/db/schema';
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
        paymentStatus: milestones.paymentStatus,
      })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .leftJoin(milestones, eq(milestones.invoiceId, invoices.id))
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[invoices GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
