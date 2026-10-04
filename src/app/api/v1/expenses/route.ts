import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { expenses, projects, purchaseOrders, vendors } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { eq, and, desc, count, isNull } from 'drizzle-orm';
import type { ExpenseCategory } from '@/types/accounts';

const EXPENSE_CATEGORIES = [
  'petty_cash',
  'transport',
  'labour',
  'material',
  'other',
] as const satisfies ExpenseCategory[];

const PAYEE_TYPES = ['vendor', 'staff', 'office', 'other'] as const;

const CreateExpenseSchema = z.object({
  projectId: z.string().uuid(),
  category: z.enum(EXPENSE_CATEGORIES),
  amountPaise: z.number().int().nonnegative(),
  description: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  loggedVia: z.string().optional(),
  vendorName: z.string().optional(),
  vendorId:   z.string().uuid().optional(),
  gstPct: z.number().int().min(0).max(28).default(0),
  gstAmountPaise: z.number().int().nonnegative().default(0),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
  paymentMode: z.string().optional(),
  payeeType: z.enum(PAYEE_TYPES).optional(),
  /** Bill this expense against a purchase order (project + vendor must match the PO). */
  poId: z.string().uuid().optional(),
}).refine(d => d.gstAmountPaise <= d.amountPaise, {
  message: 'GST cannot be more than the amount', path: ['gstAmountPaise'],
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Studio-wide spend — finance roles, matching the Accounts menu.
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const category  = searchParams.get('category') as ExpenseCategory | null;
  const unpaid    = searchParams.get('unpaid') === 'true';

  try {
    const conditions = [eq(expenses.tenantId, ctx.tenantId)];

    if (projectId) conditions.push(eq(expenses.projectId, projectId));
    if (category && (EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
      conditions.push(eq(expenses.category, category));
    }
    if (unpaid) conditions.push(isNull(expenses.paidAt));

    const rows = await db
      .select()
      .from(expenses)
      .where(and(...conditions))
      .orderBy(desc(expenses.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[expenses GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const denied = requireApiRole(ctx, ROLES.FINANCE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const input = parsed.data;

  try {
    // Verify project belongs to this tenant
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Optional PO link — the expense then counts as a bill against that PO.
    let po: { projectId: string; vendorId: string | null; status: string } | undefined;
    if (input.poId) {
      [po] = await db
        .select({ projectId: purchaseOrders.projectId, vendorId: purchaseOrders.vendorId, status: purchaseOrders.status })
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.id, input.poId), eq(purchaseOrders.tenantId, ctx.tenantId)))
        .limit(1);
      if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      if (po.status === 'cancelled') {
        return NextResponse.json({ error: 'Cannot bill a cancelled purchase order.' }, { status: 409 });
      }
      if (po.projectId !== input.projectId) {
        return NextResponse.json({ error: 'That purchase order belongs to a different project.' }, { status: 422 });
      }
      if (input.vendorId && po.vendorId && input.vendorId !== po.vendorId) {
        return NextResponse.json({ error: 'That purchase order is with a different vendor.' }, { status: 422 });
      }
    }

    const vendorId = input.vendorId ?? po?.vendorId ?? null;
    let vendorName = input.vendorName?.trim() || null;
    if (vendorId) {
      const [vendor] = await db
        .select({ name: vendors.name })
        .from(vendors)
        .where(and(eq(vendors.id, vendorId), eq(vendors.tenantId, ctx.tenantId)))
        .limit(1);
      if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      vendorName = vendorName ?? vendor.name;
    }

    // amountPaise arrives incl. GST. A PO-linked bill is stored net with GST
    // alongside (same as vendor bills) — see expenseNetPaise in project-money.
    const storedAmountPaise = input.poId ? input.amountPaise - input.gstAmountPaise : input.amountPaise;

    const [{ expCount }] = await db
      .select({ expCount: count() })
      .from(expenses)
      .where(eq(expenses.tenantId, ctx.tenantId));
    const expenseNumber = `EXP-${String(Number(expCount) + 1).padStart(4, '0')}`;

    const [expense] = await db
      .insert(expenses)
      .values({
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        category: input.category,
        amountPaise: storedAmountPaise,
        description: input.description ?? null,
        receiptUrl: input.receiptUrl ?? null,
        loggedBy: ctx.dbUserId,
        loggedVia: input.loggedVia ?? 'manual',
        vendorName,
        vendorId,
        poId:       input.poId ?? null,
        gstPct: input.gstPct,
        gstAmountPaise: input.gstAmountPaise,
        expenseNumber,
        dueDate:     input.dueDate     ?? null,
        paidAt:      input.paidAt      ? new Date(input.paidAt) : null,
        paymentMode: input.paymentMode ?? null,
        payeeType:   input.payeeType   ?? (vendorId ? 'vendor' : null),
      })
      .returning();

    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (err) {
    console.error('[expenses POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
