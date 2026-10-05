import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, attendanceRecords, leaveRequests } from '@/lib/db/schema';
import { calcPayslip, monthBounds, type PayslipCalc } from '@/lib/payroll/calculate';

export interface PayrollTotals {
  totalGrossPaise: number;
  totalNetPaise: number;
  totalEmployeePFPaise: number;
  totalEmployeeESIPaise: number;
  totalEmployerPFPaise: number;
  totalEmployerESIPaise: number;
  totalCostPaise: number;
}

export interface PayrollComputation {
  calcs: PayslipCalc[];
  totals: PayrollTotals;
}

// Employees on leave are still on payroll — their leave days come through attendance.
const PAYROLL_STATUSES = ['active', 'on_leave'];

/** Compute payslips for every payroll-eligible employee for a 'YYYY-MM' month. */
export async function computePayroll(
  tenantId: string,
  month: string,
  workingDays: number,
): Promise<PayrollComputation | null> {
  const { firstDay, lastDay } = monthBounds(month);

  const employees = await db
    .select({ id: users.id, salaryPaise: users.salaryPaise })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), inArray(users.status, PAYROLL_STATUSES)));

  if (employees.length === 0) return null;

  const attendance = await db
    .select({ userId: attendanceRecords.userId, date: attendanceRecords.date, status: attendanceRecords.status })
    .from(attendanceRecords)
    .where(and(
      eq(attendanceRecords.tenantId, tenantId),
      gte(attendanceRecords.date, firstDay),
      lte(attendanceRecords.date, lastDay),
    ));

  const leaves = await db
    .select({
      userId: leaveRequests.userId,
      fromDate: leaveRequests.fromDate,
      toDate: leaveRequests.toDate,
      leaveType: leaveRequests.leaveType,
      status: leaveRequests.status,
    })
    .from(leaveRequests)
    .where(and(
      eq(leaveRequests.tenantId, tenantId),
      eq(leaveRequests.status, 'approved'),
      lte(leaveRequests.fromDate, lastDay),
      gte(leaveRequests.toDate, firstDay),
    ));

  const calcs = employees.map(emp =>
    calcPayslip(emp, workingDays, attendance.filter(a => a.userId === emp.id), leaves),
  );

  return { calcs, totals: sumPayslips(calcs) };
}

export function sumPayslips(calcs: PayslipCalc[]): PayrollTotals {
  return calcs.reduce<PayrollTotals>(
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
}

/** Rows for the payslips table from computed payslips. */
export function payslipRows(tenantId: string, runId: string, calcs: PayslipCalc[]) {
  return calcs.map(c => ({
    tenantId,
    runId,
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
  }));
}

/** Postgres unique-violation check (drizzle wraps the pg error in `cause`). */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '23505' || e?.cause?.code === '23505';
}
