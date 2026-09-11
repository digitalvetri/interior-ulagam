import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, or, inArray, count, ne, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers, projects, leads, quotes, siteVisits, invoices, payments } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, ctx.tenantId)))
      .limit(1);

    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // All leads linked to this customer
    const customerLeads = await db
      .select({
        id:              leads.id,
        stage:           leads.stage,
        projectName:     leads.projectName,
        projectLocation: leads.projectLocation,
        budgetBand:      leads.budgetBand,
        source:          leads.source,
        createdAt:       leads.createdAt,
      })
      .from(leads)
      .where(and(eq(leads.customerId, id), eq(leads.tenantId, ctx.tenantId)));

    const allLeadIds = customerLeads.map(l => l.id);

    // Projects via customerId OR any of the customer's leadIds (handles projects
    // created before customerId was reliably set, and future edge cases)
    const projectCondition = allLeadIds.length > 0
      ? or(eq(projects.customerId, id), inArray(projects.leadId, allLeadIds))!
      : eq(projects.customerId, id);

    const linkedProjects = await db
      .select({
        id:                 projects.id,
        name:               projects.name,
        lifecycleStage:     projects.lifecycleStage,
        totalContractPaise: projects.totalContractPaise,
        leadId:             projects.leadId,
        createdAt:          projects.createdAt,
        siteAddress:        leads.projectLocation,
      })
      .from(projects)
      .leftJoin(leads, eq(projects.leadId, leads.id))
      .where(and(eq(projects.tenantId, ctx.tenantId), projectCondition))
      .limit(20);

    const totalContractPaise = linkedProjects.reduce(
      (acc, p) => acc + (p.totalContractPaise ?? 0),
      0,
    );

    // Active enquiries: leads not yet won or lost
    const activeLeads = customerLeads.filter(
      l => l.stage !== 'won' && l.stage !== 'lost',
    );

    // Quote count across all linked leads
    let quoteCount = 0;
    if (allLeadIds.length > 0) {
      const [qRow] = await db
        .select({ c: count() })
        .from(quotes)
        .where(and(eq(quotes.tenantId, ctx.tenantId), inArray(quotes.leadId, allLeadIds)));
      quoteCount = qRow?.c ?? 0;
    }

    // Site visit count across all linked leads
    let siteVisitCount = 0;
    if (allLeadIds.length > 0) {
      const [svRow] = await db
        .select({ c: count() })
        .from(siteVisits)
        .where(and(eq(siteVisits.tenantId, ctx.tenantId), inArray(siteVisits.leadId, allLeadIds)));
      siteVisitCount = svRow?.c ?? 0;
    }

    // Invoice + payment aggregates across all linked projects
    const projectIds = linkedProjects.map(p => p.id);
    let totalInvoicedPaise = 0;
    let totalReceivedPaise = 0;
    let invoiceRows: Array<{
      id: string; invoiceNumber: string; invoiceDate: string;
      subtotalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number;
      projectId: string; createdAt: Date;
    }> = [];
    let paymentRows: Array<{ id: string; invoiceId: string; amountPaise: number; createdAt: Date; }> = [];

    if (projectIds.length > 0) {
      invoiceRows = await db
        .select({
          id:            invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          invoiceDate:   invoices.invoiceDate,
          subtotalPaise: invoices.subtotalPaise,
          cgstPaise:     invoices.cgstPaise,
          sgstPaise:     invoices.sgstPaise,
          igstPaise:     invoices.igstPaise,
          projectId:     invoices.projectId,
          createdAt:     invoices.createdAt,
        })
        .from(invoices)
        .where(and(eq(invoices.tenantId, ctx.tenantId), inArray(invoices.projectId, projectIds)))
        .orderBy(desc(invoices.invoiceDate));

      const invoiceIds = invoiceRows.map(i => i.id);
      if (invoiceIds.length > 0) {
        paymentRows = await db
          .select({
            id:          payments.id,
            invoiceId:   payments.invoiceId,
            amountPaise: payments.amountPaise,
            createdAt:   payments.createdAt,
          })
          .from(payments)
          .where(and(inArray(payments.invoiceId, invoiceIds), ne(payments.status, 'pending')))
          .orderBy(desc(payments.createdAt));
      }

      totalInvoicedPaise  = invoiceRows.reduce((s, i) => s + i.subtotalPaise + i.cgstPaise + i.sgstPaise + i.igstPaise, 0);
      totalReceivedPaise  = paymentRows.reduce((s, p) => s + p.amountPaise, 0);
    }

    const enrichedInvoices = invoiceRows.map(inv => ({
      id:            inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate:   inv.invoiceDate,
      projectId:     inv.projectId,
      createdAt:     typeof inv.createdAt === 'string' ? inv.createdAt : (inv.createdAt as Date).toISOString(),
      totalPaise:    inv.subtotalPaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise,
      paidPaise:     paymentRows.filter(p => p.invoiceId === inv.id).reduce((s, p) => s + p.amountPaise, 0),
    }));

    const enrichedPayments = paymentRows.map(p => ({
      id:          p.id,
      invoiceId:   p.invoiceId,
      amountPaise: p.amountPaise,
      createdAt:   typeof p.createdAt === 'string' ? p.createdAt : (p.createdAt as Date).toISOString(),
    }));

    return NextResponse.json({
      data: {
        projectCount: linkedProjects.length,
        totalContractPaise,
        totalInvoicedPaise,
        totalReceivedPaise,
        quoteCount,
        siteVisitCount,
        projects: linkedProjects,
        leads: activeLeads,
        invoices: enrichedInvoices,
        payments: enrichedPayments,
      },
    });
  } catch (e) {
    console.error('[GET /api/v1/customers/:id/summary]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
