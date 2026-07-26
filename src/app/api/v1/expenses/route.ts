import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { expenses, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';
import type { ExpenseCategory } from '@/types/accounts';

const EXPENSE_CATEGORIES = [
  'petty_cash',
  'transport',
  'labour',
  'material',
  'other',
] as const satisfies ExpenseCategory[];

const CreateExpenseSchema = z.object({
  projectId: z.string().uuid(),
  category: z.enum(EXPENSE_CATEGORIES),
  amountPaise: z.number().int().nonnegative(),
  description: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  loggedVia: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const category = searchParams.get('category') as ExpenseCategory | null;

  try {
    const conditions = [eq(expenses.tenantId, ctx.tenantId)];

    if (projectId) {
      conditions.push(eq(expenses.projectId, projectId));
    }

    if (category && (EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
      conditions.push(eq(expenses.category, category));
    }

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

    const [expense] = await db
      .insert(expenses)
      .values({
        tenantId: ctx.tenantId,
        projectId: input.projectId,
        category: input.category,
        amountPaise: input.amountPaise,
        description: input.description ?? null,
        receiptUrl: input.receiptUrl ?? null,
        loggedBy: ctx.dbUserId,
        loggedVia: input.loggedVia ?? 'manual',
      })
      .returning();

    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (err) {
    console.error('[expenses POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
