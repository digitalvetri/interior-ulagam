import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  purchaseOrders, vendors, projects, vendorPayments,
  milestones, payments, expenses, invoices, customers,
} from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { calcCollect, calcReceived, calcToPayVendor } from '@/lib/finance/metrics';
import type { MilestoneRow, PaymentRow, PoRow } from '@/lib/finance/metrics';
import { PAYMENT_SETTLED } from '@/lib/finance/constants';

interface PoLine { totalPaise?: number; qty?: number; unitRatePaise?: number }

function poTotalPaise(linesJson: unknown): number {
  if (!Array.isArray(linesJson)) return 0;
  return (linesJson as PoLine[]).reduce((sum, l) => {
    if (typeof l.totalPaise === 'number') return sum + l.totalPaise;
    const qty  = typeof l.qty          === 'number' ? l.qty          : 0;
    const rate = typeof l.unitRatePaise === 'number' ? l.unitRatePaise : 0;
    return sum + qty * rate;
  }, 0);
}

// GET /api/v1/finance/overview
// Full finance metrics: KPIs, chase list, pay-this-week, vendor payables, 6-month chart.
// ?periodStart=&periodEnd= override the received-period (defaults to current calendar month).
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const now = new Date();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const periodStart = sp.get('periodStart') ?? mStart.toISOString();
  const periodEnd   = sp.get('periodEnd')   ?? mEnd.toISOString();
  const today = now.toISOString().split('T')[0];

  try {
    // ── Milestones (all non-paid) with invoice status ─────────────────────────
    const msRows = await db
      .select({
        id:             milestones.id,
        amountPaise:    milestones.amountPaise,
        paymentStatus:  milestones.paymentStatus,
        invoiceId:      milestones.invoiceId,
        invoiceStatus:  invoices.status,
        invoiceDueDate: invoices.dueDate,
        label:          milestones.label,
        projectId:      milestones.projectId,
        projectName:    projects.name,
        clientName:     customers.fullName,
        promisedAt:     milestones.promisedAt,
      })
      .from(milestones)
      .innerJoin(projects,  eq(milestones.projectId, projects.id))
      .leftJoin(customers,  eq(projects.customerId, customers.id))
      .leftJoin(invoices,   eq(milestones.invoiceId, invoices.id))
      .where(and(
        eq(projects.tenantId, ctx.tenantId),
        ne(milestones.paymentStatus, 'paid'),
      ))
      .orderBy(desc(milestones.createdAt));

    // settled paise per invoice
    const settledByInvoice = new Map<string, number>();
    const capturedPayments = await db
      .select({ invoiceId: payments.invoiceId, amountPaise: payments.amountPaise })
      .from(payments)
      .where(and(eq(payments.tenantId, ctx.tenantId), eq(payments.status, PAYMENT_SETTLED)));
    for (const p of capturedPayments) {
      if (!p.invoiceId) continue;
      settledByInvoice.set(p.invoiceId, (settledByInvoice.get(p.invoiceId) ?? 0) + p.amountPaise);
    }

    const milestoneRows: MilestoneRow[] = msRows.map(m => ({
      id:             m.id,
      amountPaise:    m.amountPaise,
      paymentStatus:  m.paymentStatus,
      invoiceId:      m.invoiceId ?? null,
      invoiceStatus:  m.invoiceStatus ?? null,
      invoiceDueDate: m.invoiceDueDate ?? null,
      settledPaise:   m.invoiceId ? (settledByInvoice.get(m.invoiceId) ?? 0) : 0,
    }));

    // ── All payments (for received KPI + 6-month chart + mode breakdown) ───────
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
    const allPayments = await db
      .select({
        amountPaise:  payments.amountPaise,
        status:       payments.status,
        mode:         payments.mode,
        receivedAt:   payments.receivedAt,
        reconciledAt: payments.reconciledAt,
        createdAt:    payments.createdAt,
      })
      .from(payments)
      .where(and(
        eq(payments.tenantId, ctx.tenantId),
        sql`COALESCE(${payments.receivedAt}, ${payments.reconciledAt}, ${payments.createdAt}) >= ${sixMonthsAgo}`,
      ));

    const paymentRows: PaymentRow[] = allPayments.map(p => ({
      amountPaise:  p.amountPaise,
      status:       p.status,
      receivedAt:   p.receivedAt?.toISOString()   ?? null,
      reconciledAt: p.reconciledAt?.toISOString() ?? null,
      createdAt:    p.createdAt.toISOString(),
    }));

    // ── Mode breakdown (all captured, all-time) ────────────────────────────────
    const allCaptured = await db
      .select({ mode: payments.mode, amountPaise: payments.amountPaise })
      .from(payments)
      .where(and(eq(payments.tenantId, ctx.tenantId), eq(payments.status, PAYMENT_SETTLED)));

    const modeMap = new Map<string, { amountPaise: number; count: number }>();
    for (const p of allCaptured) {
      const key = p.mode ?? 'other';
      const v   = modeMap.get(key) ?? { amountPaise: 0, count: 0 };
      v.amountPaise += p.amountPaise;
      v.count       += 1;
      modeMap.set(key, v);
    }
    const paymentByMode = Array.from(modeMap.entries())
      .map(([mode, v]) => ({ mode, amountPaise: v.amountPaise, count: v.count }))
      .sort((a, b) => b.amountPaise - a.amountPaise);

    // ── Expense breakdown (last 6 months, by category + by month) ─────────────
    const sixMoExpenses = await db
      .select({ amountPaise: expenses.amountPaise, category: expenses.category, createdAt: expenses.createdAt })
      .from(expenses)
      .where(and(
        eq(expenses.tenantId, ctx.tenantId),
        sql`${expenses.createdAt} >= ${sixMonthsAgo}`,
      ));

    const catMap = new Map<string, number>();
    const expMonthMap = new Map<string, number>();
    for (const e of sixMoExpenses) {
      catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.amountPaise);
      const d   = new Date(e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      expMonthMap.set(key, (expMonthMap.get(key) ?? 0) + e.amountPaise);
    }
    const expenseByCategory = Array.from(catMap.entries())
      .map(([category, amountPaise]) => ({ category, amountPaise }))
      .sort((a, b) => b.amountPaise - a.amountPaise);

    // ── POs (for to-pay) ──────────────────────────────────────────────────────
    const poRows = await db
      .select({
        id:          purchaseOrders.id,
        vendorName:  vendors.name,
        projectName: projects.name,
        poNumber:    purchaseOrders.poNumber,
        linesJson:   purchaseOrders.linesJson,
        status:      purchaseOrders.status,
        vendorId:    purchaseOrders.vendorId,
      })
      .from(purchaseOrders)
      .leftJoin(vendors,  eq(purchaseOrders.vendorId,  vendors.id))
      .leftJoin(projects, eq(purchaseOrders.projectId, projects.id))
      .where(and(
        eq(purchaseOrders.tenantId, ctx.tenantId),
        ne(purchaseOrders.status, 'cancelled'),
      ));

    const vpRows = await db
      .select({
        purchaseOrderId: vendorPayments.purchaseOrderId,
        expenseId:       vendorPayments.expenseId,
        amountPaise:     vendorPayments.amountPaise,
      })
      .from(vendorPayments)
      .where(eq(vendorPayments.tenantId, ctx.tenantId));

    // Bill-allocated payments (expenseId IS NOT NULL) drive Vendor Payables.
    // Advance/unallocated payments (expenseId IS NULL) are tracked separately.
    const billPaidByPo  = new Map<string, number>();
    const advanceByPo   = new Map<string, number>();
    for (const vp of vpRows) {
      if (!vp.purchaseOrderId) continue;
      if (vp.expenseId) {
        billPaidByPo.set(vp.purchaseOrderId, (billPaidByPo.get(vp.purchaseOrderId) ?? 0) + vp.amountPaise);
      } else {
        advanceByPo.set(vp.purchaseOrderId, (advanceByPo.get(vp.purchaseOrderId) ?? 0) + vp.amountPaise);
      }
    }

    // Billed total per PO = sum of active (non-void) vendor bills
    const billExpRows = await db
      .select({
        poId:           expenses.poId,
        amountPaise:    expenses.amountPaise,
        gstAmountPaise: expenses.gstAmountPaise,
        voidedAt:       expenses.voidedAt,
      })
      .from(expenses)
      .where(and(eq(expenses.tenantId, ctx.tenantId), isNotNull(expenses.poId)));

    const billedByPo = new Map<string, number>();
    for (const b of billExpRows) {
      if (!b.poId || b.voidedAt) continue;
      billedByPo.set(b.poId, (billedByPo.get(b.poId) ?? 0) + b.amountPaise + b.gstAmountPaise);
    }

    const poMetrics: PoRow[] = poRows.map(po => ({
      totalPaise:  poTotalPaise(po.linesJson),
      billedPaise: billedByPo.get(po.id) ?? 0,
      paidPaise:   billPaidByPo.get(po.id) ?? 0,
      status:      po.status,
    }));

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const { toCollectPaise, overduePaise, notYetInvoicedPaise } = calcCollect(milestoneRows, today);
    const receivedPaise    = calcReceived(paymentRows, periodStart, periodEnd);
    const toPayVendorPaise = calcToPayVendor(poMetrics);

    // ── Chase today (top 8 by days late, collectible only) ────────────────────
    const chaseList = msRows
      .filter(m => {
        const inv = m.invoiceStatus;
        return inv === 'issued' || inv === 'part_paid';
      })
      .map(m => {
        const balance = Math.max(0, m.amountPaise - (m.invoiceId ? (settledByInvoice.get(m.invoiceId) ?? 0) : 0));
        const daysLate = m.invoiceDueDate
          ? Math.max(0, Math.floor((now.getTime() - new Date(m.invoiceDueDate).getTime()) / 86400000))
          : 0;
        return {
          milestoneId:    m.id,
          projectId:      m.projectId,
          projectName:    m.projectName,
          clientName:     m.clientName,
          label:          m.label,
          balancePaise:   balance,
          daysLate,
          dueDate:        m.invoiceDueDate ?? null,
          promisedAt:     m.promisedAt?.toISOString() ?? null,
        };
      })
      .filter(r => r.balancePaise > 0)
      .sort((a, b) => b.daysLate - a.daysLate)
      .slice(0, 8);

    // ── Pay this week (vendor bill balances, by billed − paid) ───────────────
    const payThisWeek = poRows
      .map(po => ({
        poId:         po.id,
        poNumber:     po.poNumber,
        vendorName:   po.vendorName  ?? 'Unknown',
        projectName:  po.projectName ?? 'Unknown',
        balancePaise: Math.max(0, (billedByPo.get(po.id) ?? 0) - (billPaidByPo.get(po.id) ?? 0)),
        status:       po.status,
      }))
      .filter(r => r.balancePaise > 0)
      .sort((a, b) => b.balancePaise - a.balancePaise)
      .slice(0, 5);

    // ── 6-month chart (received + expenses per month) ─────────────────────────
    const chartMonths: { label: string; receivedPaise: number; expensesPaise: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString();
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
      const mKey  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      chartMonths.push({
        label:         d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
        receivedPaise: calcReceived(paymentRows, start, end),
        expensesPaise: expMonthMap.get(mKey) ?? 0,
      });
    }

    // ── Aging buckets (all collectible milestones, NOT just chase top-8) ──────
    const agingBuckets = { notYetDuePaise: 0, d0to30Paise: 0, d31to60Paise: 0, d60plusPaise: 0 };
    for (const m of msRows) {
      if (m.invoiceStatus !== 'issued' && m.invoiceStatus !== 'part_paid') continue;
      const balance = Math.max(0, m.amountPaise - (m.invoiceId ? (settledByInvoice.get(m.invoiceId) ?? 0) : 0));
      if (balance === 0) continue;
      if (!m.invoiceDueDate) { agingBuckets.notYetDuePaise += balance; continue; }
      const daysLate = Math.floor((now.getTime() - new Date(m.invoiceDueDate).getTime()) / 86400000);
      if (daysLate <= 0)       agingBuckets.notYetDuePaise += balance;
      else if (daysLate <= 30) agingBuckets.d0to30Paise    += balance;
      else if (daysLate <= 60) agingBuckets.d31to60Paise   += balance;
      else                     agingBuckets.d60plusPaise    += balance;
    }

    // ── Vendor payables list ──────────────────────────────────────────────────
    // Payable = Billed Total − Bill Payments (NOT PO commitment − all payments).
    // Only POs that have at least one active vendor bill are included.
    const vendorPayables = poRows
      .map(po => ({
        id:                  po.id,
        vendor_name:         po.vendorName  ?? 'Unknown vendor',
        project_name:        po.projectName ?? 'Unknown project',
        po_number:           po.poNumber,
        po_total_paise:      poTotalPaise(po.linesJson),
        billed_amount_paise: billedByPo.get(po.id) ?? 0,
        paid_amount_paise:   billPaidByPo.get(po.id) ?? 0,
        status:              po.status,
      }))
      .filter(r => r.billed_amount_paise > 0)
      .sort((a, b) =>
        (b.billed_amount_paise - b.paid_amount_paise) -
        (a.billed_amount_paise - a.paid_amount_paise),
      );

    return NextResponse.json({
      data: {
        kpis: {
          toCollectPaise,
          overduePaise,
          notYetInvoicedPaise,
          receivedPaise,
          toPayVendorPaise,
        },
        chaseList,
        payThisWeek,
        chartMonths,
        vendorPayables,
        expenseByCategory,
        paymentByMode,
        agingBuckets,
      },
    });
  } catch (err) {
    console.error('[GET /api/v1/finance/overview]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
