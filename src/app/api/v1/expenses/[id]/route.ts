import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { expenses, projects, users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/expenses/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid expense id' }, { status: 400 });
  }

  try {
    const [row] = await db
      .select({
        id:              expenses.id,
        tenantId:        expenses.tenantId,
        projectId:       expenses.projectId,
        category:        expenses.category,
        amountPaise:     expenses.amountPaise,
        description:     expenses.description,
        receiptUrl:      expenses.receiptUrl,
        loggedBy:        expenses.loggedBy,
        loggedVia:       expenses.loggedVia,
        approvedBy:      expenses.approvedBy,
        approvedAt:      expenses.approvedAt,
        vendorName:      expenses.vendorName,
        gstPct:          expenses.gstPct,
        gstAmountPaise:  expenses.gstAmountPaise,
        createdAt:       expenses.createdAt,
        projectName:     projects.name,
        loggedByName:    users.fullName,
      })
      .from(expenses)
      .leftJoin(projects, eq(expenses.projectId, projects.id))
      .leftJoin(users,    eq(expenses.loggedBy,  users.id))
      .where(and(eq(expenses.id, id), eq(expenses.tenantId, ctx.tenantId)))
      .limit(1);

    if (!row) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[GET /api/v1/expenses/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/v1/expenses/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid expense id' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const schema = z.object({
    description: z.string().optional(),
    vendorName:  z.string().optional(),
    receiptUrl:  z.string().url().optional(),
    approve:     z.boolean().optional(),
  }).refine(d => Object.keys(d).length > 0, { message: 'No fields to update' });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const [existing] = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.tenantId, ctx.tenantId)))
      .limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updates: Partial<typeof expenses.$inferInsert> = {};
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.vendorName  !== undefined) updates.vendorName  = parsed.data.vendorName;
    if (parsed.data.receiptUrl  !== undefined) updates.receiptUrl  = parsed.data.receiptUrl;
    if (parsed.data.approve) {
      updates.approvedBy = ctx.userId;
      updates.approvedAt = new Date();
    }

    const [updated] = await db
      .update(expenses)
      .set(updates)
      .where(eq(expenses.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error('[PATCH /api/v1/expenses/[id]]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
