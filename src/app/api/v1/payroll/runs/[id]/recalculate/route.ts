import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { payrollRuns, payslips } from '@/lib/db/schema';
import { requireAuth, requireApiRole, ROLES } from '@/lib/auth';
import { computePayroll, payslipRows } from '@/lib/payroll/build';

const RecalcSchema = z.object({
  workingDays: z.number().int().min(1).max(31).optional(),
});

// POST /api/v1/payroll/runs/[id]/recalculate — owner only, draft runs only.
// Rebuilds every payslip from current salaries, attendance and approved leave.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid payroll run id' }, { status: 400 });
  }

  let body: unknown = {};
  try { body = await request.json(); } catch { /* empty body is fine */ }
  const parsed = RecalcSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const [run] = await db
    .select({ id: payrollRuns.id, month: payrollRuns.month, status: payrollRuns.status, workingDays: payrollRuns.workingDays })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.tenantId, ctx.tenantId)))
    .limit(1);

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (run.status !== 'draft') {
    return NextResponse.json({ error: `Only draft runs can be recalculated — this run is ${run.status}` }, { status: 409 });
  }

  const workingDays = parsed.data.workingDays ?? run.workingDays;
  const computed = await computePayroll(ctx.tenantId, run.month, workingDays);
  if (!computed) {
    return NextResponse.json({ error: 'No active employees found' }, { status: 400 });
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(payrollRuns)
      .set({ workingDays, ...computed.totals })
      .where(and(eq(payrollRuns.id, id), eq(payrollRuns.tenantId, ctx.tenantId), eq(payrollRuns.status, 'draft')))
      .returning();
    if (!row) return null;

    await tx.delete(payslips).where(and(eq(payslips.runId, id), eq(payslips.tenantId, ctx.tenantId)));
    await tx.insert(payslips).values(payslipRows(ctx.tenantId, id, computed.calcs));
    return row;
  });

  if (!updated) {
    return NextResponse.json({ error: 'The payroll run is no longer a draft' }, { status: 409 });
  }

  return NextResponse.json({ data: updated, message: 'Payroll recalculated' });
}
