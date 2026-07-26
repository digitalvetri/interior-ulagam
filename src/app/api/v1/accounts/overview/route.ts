import { NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  payments, invoices, projects, milestones,
} from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

export interface ReceivableRow {
  id: string;
  projectId: string;
  projectName: string;
  label: string;
  amountPaise: number;
  paymentStatus: 'pending' | 'link_sent' | 'overdue';
  createdAt: string;
  daysSinceCreation: number;
}

export interface PaymentRow {
  id: string;
  invoiceId: string;
  projectId: string | null;
  projectName: string | null;
  invoiceNumber: string | null;
  amountPaise: number;
  status: string;
  source: 'razorpay' | 'manual';
  reference: string | null;
  reconciledAt: string | null;
  createdAt: string;
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // ─── KPI aggregates ─────────────────────────────────────────
    const [outstandingAgg] = await db
      .select({
        outstandingPaise: sql<number>`
          coalesce(sum(m.amount_paise) filter (where m.payment_status <> 'paid'), 0)::bigint
        `,
        overduePaise: sql<number>`
          coalesce(sum(m.amount_paise) filter (where m.payment_status = 'overdue'), 0)::bigint
        `,
        openCount: sql<number>`
          count(*) filter (where m.payment_status <> 'paid')::int
        `,
      })
      .from(sql`milestones m`)
      .innerJoin(projects, sql`m.project_id = ${projects.id}`)
      .where(eq(projects.tenantId, ctx.tenantId));

    const [captured30d] = await db
      .select({
        paise: sql<number>`coalesce(sum(amount_paise), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(and(
        eq(payments.tenantId, ctx.tenantId),
        eq(payments.status, 'captured'),
        sql`coalesce(reconciled_at, created_at) >= (now() - interval '30 days')`,
      ));

    const [capturedAll] = await db
      .select({
        paise: sql<number>`coalesce(sum(amount_paise), 0)::bigint`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(and(
        eq(payments.tenantId, ctx.tenantId),
        eq(payments.status, 'captured'),
      ));

    // ─── Receivables list ───────────────────────────────────────
    const receivableRows = await db
      .select({
        id: milestones.id,
        projectId: milestones.projectId,
        projectName: projects.name,
        label: milestones.label,
        amountPaise: milestones.amountPaise,
        paymentStatus: milestones.paymentStatus,
        createdAt: milestones.createdAt,
      })
      .from(milestones)
      .innerJoin(projects, eq(milestones.projectId, projects.id))
      .where(and(
        eq(projects.tenantId, ctx.tenantId),
        sql`${milestones.paymentStatus} <> 'paid'`,
      ))
      .orderBy(desc(milestones.createdAt));

    const receivables: ReceivableRow[] = receivableRows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectName: r.projectName ?? '(unnamed project)',
      label: r.label,
      amountPaise: r.amountPaise,
      paymentStatus: r.paymentStatus as ReceivableRow['paymentStatus'],
      createdAt: r.createdAt.toISOString(),
      daysSinceCreation: Math.max(0, Math.floor((Date.now() - r.createdAt.getTime()) / 86400000)),
    }));

    // ─── Payments list (all statuses, joined for project/invoice info) ──
    const paymentRows = await db
      .select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        amountPaise: payments.amountPaise,
        status: payments.status,
        razorpayLinkId: payments.razorpayLinkId,
        razorpayPaymentId: payments.razorpayPaymentId,
        manualOverrideNote: payments.manualOverrideNote,
        reconciledAt: payments.reconciledAt,
        createdAt: payments.createdAt,
        invoiceNumber: invoices.invoiceNumber,
        projectId: invoices.projectId,
        projectName: projects.name,
      })
      .from(payments)
      .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
      .leftJoin(projects, eq(invoices.projectId, projects.id))
      .where(eq(payments.tenantId, ctx.tenantId))
      .orderBy(desc(payments.createdAt))
      .limit(200);

    const paymentList: PaymentRow[] = paymentRows.map((p) => ({
      id: p.id,
      invoiceId: p.invoiceId,
      projectId: p.projectId ?? null,
      projectName: p.projectName ?? null,
      invoiceNumber: p.invoiceNumber ?? null,
      amountPaise: p.amountPaise,
      status: p.status,
      source: p.razorpayPaymentId ? 'razorpay' : 'manual',
      reference: p.razorpayPaymentId ?? p.razorpayLinkId ?? p.manualOverrideNote ?? null,
      reconciledAt: p.reconciledAt ? p.reconciledAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({
      data: {
        kpis: {
          outstandingPaise:      Number(outstandingAgg?.outstandingPaise ?? 0),
          overduePaise:          Number(outstandingAgg?.overduePaise ?? 0),
          openReceivableCount:   Number(outstandingAgg?.openCount ?? 0),
          collected30dPaise:     Number(captured30d?.paise ?? 0),
          collected30dCount:     Number(captured30d?.count ?? 0),
          collectedAllTimePaise: Number(capturedAll?.paise ?? 0),
          collectedAllTimeCount: Number(capturedAll?.count ?? 0),
        },
        receivables,
        payments: paymentList,
      },
    });
  } catch (e) {
    console.error('[GET /api/v1/accounts/overview]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
