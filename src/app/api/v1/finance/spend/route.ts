import { NextResponse } from 'next/server';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { expenses, projects, purchaseOrders, vendorPayments, vendors } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { combineSpend } from '@/lib/finance/spend';
import { poTotalPaise } from '@/lib/project-money/calc';

// GET /api/v1/finance/spend — Accounts → Expenses.
// Every expense (site/manual), vendor bill and unbilled PO balance in one list,
// on the project money engine's cost basis, plus the projects / vendors / POs
// the "New expense" form links to. No profit here — costs only.
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  try {
    const [expRows, poRows, payRows, projectRows, vendorRows] = await Promise.all([
      db.select({
        id: expenses.id, expenseNumber: expenses.expenseNumber, projectId: expenses.projectId, poId: expenses.poId,
        vendorId: expenses.vendorId, vendorName: expenses.vendorName, category: expenses.category,
        description: expenses.description, amountPaise: expenses.amountPaise, gstPct: expenses.gstPct,
        gstAmountPaise: expenses.gstAmountPaise, paidAt: expenses.paidAt, voidedAt: expenses.voidedAt,
        createdAt: expenses.createdAt,
      }).from(expenses).where(eq(expenses.tenantId, ctx.tenantId)),
      db.select({
        id: purchaseOrders.id, poNumber: purchaseOrders.poNumber, projectId: purchaseOrders.projectId,
        vendorId: purchaseOrders.vendorId, vendorName: vendors.name, vendorContactName: purchaseOrders.vendorContactName,
        linesJson: purchaseOrders.linesJson, status: purchaseOrders.status, createdAt: purchaseOrders.createdAt,
      }).from(purchaseOrders)
        .leftJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
        .where(eq(purchaseOrders.tenantId, ctx.tenantId))
        .orderBy(desc(purchaseOrders.createdAt)),
      db.select({
        purchaseOrderId: vendorPayments.purchaseOrderId, expenseId: vendorPayments.expenseId, amountPaise: vendorPayments.amountPaise,
      }).from(vendorPayments).where(eq(vendorPayments.tenantId, ctx.tenantId)),
      db.select({ id: projects.id, name: projects.name, stage: projects.lifecycleStage })
        .from(projects).where(eq(projects.tenantId, ctx.tenantId)).orderBy(asc(projects.name)),
      db.select({ id: vendors.id, name: vendors.name })
        .from(vendors).where(eq(vendors.tenantId, ctx.tenantId)).orderBy(asc(vendors.name)),
    ]);

    const pos = poRows.map(po => ({ ...po, vendorName: po.vendorName ?? po.vendorContactName ?? null }));
    const rows = combineSpend({
      expenses: expRows.map(e => ({ ...e, amountPaise: Number(e.amountPaise), gstAmountPaise: Number(e.gstAmountPaise) })),
      purchaseOrders: pos,
      vendorPayments: payRows.map(p => ({ ...p, amountPaise: Number(p.amountPaise) })),
      projectNames: new Map(projectRows.map(p => [p.id, p.name])),
    });

    return NextResponse.json({
      data: {
        rows,
        options: {
          projects: projectRows,
          vendors: vendorRows,
          purchaseOrders: pos.filter(po => po.status !== 'cancelled').map(po => ({
            id: po.id, poNumber: po.poNumber, projectId: po.projectId, vendorId: po.vendorId,
            vendorName: po.vendorName, totalPaise: poTotalPaise(po.linesJson),
          })),
        },
      },
    });
  } catch (err) {
    console.error('[finance/spend GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
