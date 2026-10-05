import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, payrollRuns, payslips } from '@/lib/db/schema';
import { requireAuth, requireApiRole, ROLES } from '@/lib/auth';
import { isAllowedRunTransition } from '@/lib/payroll/calculate';

const StatusSchema = z.object({
  status: z.enum(['approved', 'paid']),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  // Every payslip in the run — owner only, matching the Payroll menu.
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  const { id } = await params;

  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.tenantId, ctx.tenantId)))
    .limit(1);

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const slips = await db
    .select({
      id: payslips.id,
      userId: payslips.userId,
      fullName: users.fullName,
      jobTitle: users.jobTitle,
      department: users.department,
      salaryPaise: users.salaryPaise,
      daysPresent: payslips.daysPresent,
      daysAbsent: payslips.daysAbsent,
      grossPaise: payslips.grossPaise,
      employeePFPaise: payslips.employeePFPaise,
      employeeESIPaise: payslips.employeeESIPaise,
      netPaise: payslips.netPaise,
      employerPFPaise: payslips.employerPFPaise,
      employerESIPaise: payslips.employerESIPaise,
      totalCostPaise: payslips.totalCostPaise,
    })
    .from(payslips)
    .innerJoin(users, eq(payslips.userId, users.id))
    .where(and(eq(payslips.runId, id), eq(payslips.tenantId, ctx.tenantId)))
    .orderBy(users.fullName);

  return NextResponse.json({ data: { ...run, payslips: slips } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can update payroll runs' }, { status: 403 });
  }
  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const [run] = await db
    .select({ status: payrollRuns.status })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.tenantId, ctx.tenantId)))
    .limit(1);

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Enforce one step at a time: draft → approved → paid (no skipping approval)
  if (!isAllowedRunTransition(run.status, parsed.data.status)) {
    return NextResponse.json(
      { error: run.status === 'draft' && parsed.data.status === 'paid'
          ? 'Approve the payroll run before marking it paid'
          : `Cannot change a ${run.status} run to ${parsed.data.status}` },
      { status: 409 },
    );
  }

  const [updated] = await db
    .update(payrollRuns)
    .set({ status: parsed.data.status })
    // Status guard in the WHERE makes a concurrent double transition a no-op
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.tenantId, ctx.tenantId), eq(payrollRuns.status, run.status)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'The payroll run changed meanwhile — reload and try again' }, { status: 409 });
  }

  return NextResponse.json({ data: updated });
}

// DELETE /api/v1/payroll/runs/[id] — owner only, draft runs only (payslips cascade)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireAuth();
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid payroll run id' }, { status: 400 });
  }

  const [deleted] = await db
    .delete(payrollRuns)
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.tenantId, ctx.tenantId), eq(payrollRuns.status, 'draft')))
    .returning({ id: payrollRuns.id });

  if (!deleted) {
    const [exists] = await db
      .select({ status: payrollRuns.status })
      .from(payrollRuns)
      .where(and(eq(payrollRuns.id, id), eq(payrollRuns.tenantId, ctx.tenantId)))
      .limit(1);
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: `Only draft runs can be deleted — this run is ${exists.status}` }, { status: 409 });
  }

  return NextResponse.json({ data: deleted, message: 'Payroll run deleted' });
}
