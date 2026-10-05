// PF: 12% of gross, capped at ₹1,800/month (based on ₹15,000 pensionable wage ceiling)
const PF_RATE_PCT = 12;
const PF_CAP_PAISE = 180_000;

// ESI: applies only when monthly gross ≤ ₹21,000
const ESI_THRESHOLD_PAISE = 2_100_000;
const EMPLOYEE_ESI_BPS = 75;   // 0.75%
const EMPLOYER_ESI_BPS = 325;  // 3.25%

// Leave types that are unpaid even when approved
const UNPAID_LEAVE_TYPES = new Set(['unpaid']);

export interface AttendanceRow {
  userId: string;
  date: string;   // YYYY-MM-DD
  status: 'present' | 'absent' | 'leave' | 'half_day' | 'late' | 'holiday';
}

export interface LeaveRow {
  userId: string;
  fromDate: string;
  toDate: string;
  leaveType: string;
  status: string;
}

export interface PayslipCalc {
  userId: string;
  daysPresent: number;
  daysAbsent: number;
  grossPaise: number;
  employeePFPaise: number;
  employeeESIPaise: number;
  netPaise: number;
  employerPFPaise: number;
  employerESIPaise: number;
  totalCostPaise: number;
}

function buildPaidLeaveDates(leaves: LeaveRow[], userId: string): Set<string> {
  const dates = new Set<string>();
  for (const leave of leaves) {
    if (leave.userId !== userId) continue;
    if (leave.status !== 'approved') continue;
    if (UNPAID_LEAVE_TYPES.has(leave.leaveType)) continue;
    const cursor = new Date(leave.fromDate);
    const end = new Date(leave.toDate);
    while (cursor <= end) {
      dates.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return dates;
}

export function calcPayslip(
  employee: { id: string; salaryPaise: number | null },
  workingDays: number,
  attendance: AttendanceRow[],
  leaves: LeaveRow[],
): PayslipCalc {
  const salaryPaise = employee.salaryPaise ?? 0;
  const paidLeaveDates = buildPaidLeaveDates(leaves, employee.id);

  let daysPresent = 0;
  for (const rec of attendance) {
    switch (rec.status) {
      case 'present':
      case 'late':
        daysPresent += 1;
        break;
      case 'half_day':
        daysPresent += 0.5;
        break;
      case 'leave':
        if (paidLeaveDates.has(rec.date)) daysPresent += 1;
        break;
      // 'absent' and 'holiday' do not add to daysPresent
      // (holidays are excluded from workingDays by the owner when creating the run)
    }
  }

  const effectivePresent = Math.min(daysPresent, workingDays);
  const daysAbsent = Math.max(0, workingDays - effectivePresent);

  const grossPaise = workingDays > 0
    ? Math.round(salaryPaise * effectivePresent / workingDays)
    : 0;

  const employeePFPaise = Math.min(Math.floor(grossPaise * PF_RATE_PCT / 100), PF_CAP_PAISE);
  const employeeESIPaise = grossPaise <= ESI_THRESHOLD_PAISE
    ? Math.floor(grossPaise * EMPLOYEE_ESI_BPS / 10_000)
    : 0;

  const netPaise = grossPaise - employeePFPaise - employeeESIPaise;

  const employerPFPaise = employeePFPaise;
  const employerESIPaise = grossPaise <= ESI_THRESHOLD_PAISE
    ? Math.floor(grossPaise * EMPLOYER_ESI_BPS / 10_000)
    : 0;

  // Employer's cost = full gross (net pay + employee deductions remitted on the
  // employee's behalf) + the employer's own PF/ESI contributions.
  const totalCostPaise = grossPaise + employerPFPaise + employerESIPaise;

  return {
    userId: employee.id,
    daysPresent: effectivePresent,
    daysAbsent,
    grossPaise,
    employeePFPaise,
    employeeESIPaise,
    netPaise,
    employerPFPaise,
    employerESIPaise,
    totalCostPaise,
  };
}

/**
 * First and last calendar day of a 'YYYY-MM' month as 'YYYY-MM-DD' strings.
 * Computed in UTC so the result never depends on the server's time zone.
 */
export function monthBounds(month: string): { firstDay: string; lastDay: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const lastDate = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return {
    firstDay: `${month}-01`,
    lastDay: `${month}-${String(lastDate).padStart(2, '0')}`,
  };
}

export type PayrollRunStatus = 'draft' | 'approved' | 'paid';

/** Payroll runs move one step at a time: draft → approved → paid. */
export function isAllowedRunTransition(from: PayrollRunStatus, to: PayrollRunStatus): boolean {
  return (from === 'draft' && to === 'approved') || (from === 'approved' && to === 'paid');
}
