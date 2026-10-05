import { NextRequest, NextResponse } from 'next/server';
import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { payrollRuns, payslips } from '@/lib/db/schema';
import { requireAuth, requireApiRole, ROLES } from '@/lib/auth';
import { computePayroll, payslipRows, isUniqueViolation } from '@/lib/payroll/build';

const CreateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
  workingDays: z.number().int().min(1).max(31).default(26),
  notes: z.string().max(500).optional(),
});

export async function GET() {
  const ctx = await requireAuth();
  // Pay for every employee — owner only, matching the Payroll menu.
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const runs = await db
    .select({
      id: payrollRuns.id,
      month: payrollRuns.month,
      status: payrollRuns.status,
      workingDays: payrollRuns.workingDays,
      totalGrossPaise: payrollRuns.totalGrossPaise,
      totalNetPaise: payrollRuns.totalNetPaise,
      totalCostPaise: payrollRuns.totalCostPaise,
      notes: payrollRuns.notes,
      createdAt: payrollRuns.createdAt,
    })
    .from(payrollRuns)
    .where(eq(payrollRuns.tenantId, ctx.tenantId))
    .orderBy(desc(payrollRuns.month));

  return NextResponse.json({ data: runs });
}

export async function POST(request: NextRequest) {
  const ctx = await requireAuth();
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can create payroll runs' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }
  const { month, workingDays, notes } = parsed.data;

  // Prevent duplicate runs for the same month (a draft can be recalculated or deleted instead)
  const existing = await db
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.tenantId, ctx.tenantId), eq(payrollRuns.month, month)))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: `A payroll run for ${month} already exists. Open it to recalculate or delete the draft.` }, { status: 409 });
  }

  const computed = await computePayroll(ctx.tenantId, month, workingDays);
  if (!computed) {
    return NextResponse.json({ error: 'No active employees found' }, { status: 400 });
  }
  const { calcs, totals } = computed;

  // Insert run + payslips in a transaction. The (tenant, month) unique index
  // turns a double-click race into a 409 instead of a 500.
  let run: typeof payrollRuns.$inferSelect | undefined;
  try {
    [run] = await db.transaction(async (tx) => {
      const [newRun] = await tx
        .insert(payrollRuns)
        .values({
          tenantId: ctx.tenantId,
          month,
          workingDays,
          notes: notes ?? null,
          createdBy: ctx.userId,
          ...totals,
        })
        .returning();

      await tx.insert(payslips).values(payslipRows(ctx.tenantId, newRun!.id, calcs));

      return [newRun];
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: `A payroll run for ${month} already exists` }, { status: 409 });
    }
    console.error('[POST /api/v1/payroll/runs]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ data: run }, { status: 201 });
}
