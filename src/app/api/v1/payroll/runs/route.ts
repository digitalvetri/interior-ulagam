import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, attendanceRecords, leaveRequests, payrollRuns, payslips } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth';
import { calcPayslip } from '@/lib/payroll/calculate';

const CreateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
  workingDays: z.number().int().min(1).max(31).default(26),
  notes: z.string().max(500).optional(),
});

export async function GET() {
  const ctx = await requireAuth();

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
  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can create payroll runs' }, { status: 403 });
  }

  const body = await request.json() as unknown;
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { month, workingDays, notes } = parsed.data;

  // Prevent duplicate runs for the same month
  const existing = await db
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.tenantId, ctx.tenantId), eq(payrollRuns.month, month)))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: `A payroll run for ${month} already exists` }, { status: 409 });
  }

  // Date range for the month
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const firstDay = `${month}-01`;
  const lastDay = new Date(year, mon, 0).toISOString().slice(0, 10); // last day of month

  // All active employees for this tenant
  const employees = await db
    .select({ id: users.id, fullName: users.fullName, salaryPaise: users.salaryPaise })
    .from(users)
    .where(and(eq(users.tenantId, ctx.tenantId), eq(users.status, 'active')));

  if (employees.length === 0) {
    return NextResponse.json({ error: 'No active employees found' }, { status: 400 });
  }

  // Attendance records for the month
  const attendance = await db
    .select({ userId: attendanceRecords.userId, date: attendanceRecords.date, status: attendanceRecords.status })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.tenantId, ctx.tenantId),
        gte(attendanceRecords.date, firstDay),
        lte(attendanceRecords.date, lastDay),
      ),
    );

  // Approved leave requests overlapping the month
  const leaves = await db
    .select({
      userId: leaveRequests.userId,
      fromDate: leaveRequests.fromDate,
      toDate: leaveRequests.toDate,
      leaveType: leaveRequests.leaveType,
      status: leaveRequests.status,
    })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.tenantId, ctx.tenantId),
        eq(leaveRequests.status, 'approved'),
        lte(leaveRequests.fromDate, lastDay),
        gte(leaveRequests.toDate, firstDay),
      ),
    );

  // Calculate payslip for each employee
  const calcs = employees.map(emp =>
    calcPayslip(
      emp,
      workingDays,
      attendance.filter(a => a.userId === emp.id),
      leaves,
    ),
  );

  // Aggregate totals
  const totals = calcs.reduce(
    (acc, c) => ({
      totalGrossPaise: acc.totalGrossPaise + c.grossPaise,
      totalNetPaise: acc.totalNetPaise + c.netPaise,
      totalEmployeePFPaise: acc.totalEmployeePFPaise + c.employeePFPaise,
      totalEmployeeESIPaise: acc.totalEmployeeESIPaise + c.employeeESIPaise,
      totalEmployerPFPaise: acc.totalEmployerPFPaise + c.employerPFPaise,
      totalEmployerESIPaise: acc.totalEmployerESIPaise + c.employerESIPaise,
      totalCostPaise: acc.totalCostPaise + c.totalCostPaise,
    }),
    {
      totalGrossPaise: 0, totalNetPaise: 0,
      totalEmployeePFPaise: 0, totalEmployeeESIPaise: 0,
      totalEmployerPFPaise: 0, totalEmployerESIPaise: 0,
      totalCostPaise: 0,
    },
  );

  // Insert run + payslips in a transaction
  const [run] = await db.transaction(async (tx) => {
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

    await tx.insert(payslips).values(
      calcs.map(c => ({
        tenantId: ctx.tenantId,
        runId: newRun!.id,
        userId: c.userId,
        daysPresent: String(c.daysPresent),
        daysAbsent: String(c.daysAbsent),
        grossPaise: c.grossPaise,
        employeePFPaise: c.employeePFPaise,
        employeeESIPaise: c.employeeESIPaise,
        netPaise: c.netPaise,
        employerPFPaise: c.employerPFPaise,
        employerESIPaise: c.employerESIPaise,
        totalCostPaise: c.totalCostPaise,
      })),
    );

    return [newRun];
  });

  return NextResponse.json({ data: run }, { status: 201 });
}
