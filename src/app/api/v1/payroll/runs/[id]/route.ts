import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, payrollRuns, payslips } from '@/lib/db/schema';
import { requireAuth, requireApiRole, ROLES } from '@/lib/auth';

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
    .where(eq(payslips.runId, id))
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

  const body = await request.json() as unknown;
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const [run] = await db
    .select({ status: payrollRuns.status })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.tenantId, ctx.tenantId)))
    .limit(1);

  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Enforce forward-only transitions: draft → approved → paid
  const ORDER = { draft: 0, approved: 1, paid: 2 };
  if (ORDER[parsed.data.status] <= ORDER[run.status]) {
    return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });
  }

  const [updated] = await db
    .update(payrollRuns)
    .set({ status: parsed.data.status })
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.tenantId, ctx.tenantId)))
    .returning();

  return NextResponse.json({ data: updated });
}
