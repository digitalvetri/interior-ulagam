import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, staffDayLogs, users } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { StaffDaysInput } from '@/types/project-money';
import { invalid, readJson, serverError } from '@/lib/civil/server';

// Weekly grid of days each salaried staff member spent on each project.
// Owner only: day rates come from salaries.

/** Working days a monthly salary is spread over (matches Payroll). */
const WORKING_DAYS = 26;

function isMonday(iso: string): boolean {
  return new Date(`${iso}T00:00:00Z`).getUTCDay() === 1;
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const week = request.nextUrl.searchParams.get('week') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !isMonday(week)) {
    return NextResponse.json({ error: 'week must be a Monday, yyyy-mm-dd' }, { status: 400 });
  }

  try {
    const [staff, logs] = await Promise.all([
      db.select({ id: users.id, fullName: users.fullName, role: users.role, salaryPaise: users.salaryPaise })
        .from(users)
        .where(and(eq(users.tenantId, ctx.tenantId), ne(users.status, 'inactive'), sql`${users.salaryPaise} > 0`))
        .orderBy(asc(users.fullName)),
      db.select({ userId: staffDayLogs.userId, projectId: staffDayLogs.projectId, days: staffDayLogs.days })
        .from(staffDayLogs).where(and(eq(staffDayLogs.tenantId, ctx.tenantId), eq(staffDayLogs.weekStart, week))),
    ]);
    const loggedProjectIds = [...new Set(logs.map(l => l.projectId).filter((x): x is string => !!x))];
    const projectRows = await db.select({ id: projects.id, name: projects.name, stage: projects.lifecycleStage })
      .from(projects)
      .where(and(eq(projects.tenantId, ctx.tenantId), or(
        ne(projects.lifecycleStage, 'complete'),
        loggedProjectIds.length ? inArray(projects.id, loggedProjectIds) : undefined,
      )))
      .orderBy(asc(projects.name));

    return NextResponse.json({
      data: {
        weekStart: week,
        workingDays: WORKING_DAYS,
        staff: staff.map(s => ({ ...s, dayRatePaise: Math.round(Number(s.salaryPaise) / WORKING_DAYS) })),
        projects: projectRows,
        logs: logs.map(l => ({ ...l, days: Number(l.days) })),
      },
    });
  } catch (err) {
    return serverError('staff-days GET', err);
  }
}

/** Replace the whole week for the staff in `rows` (a person with no rows keeps nothing that week). */
export async function PUT(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const parsed = StaffDaysInput.safeParse(await readJson(request));
  if (!parsed.success) return invalid(parsed.error);
  const { weekStart, rows } = parsed.data;
  if (!isMonday(weekStart)) return NextResponse.json({ error: 'weekStart must be a Monday' }, { status: 422 });

  const perUser = new Map<string, number>();
  for (const r of rows) perUser.set(r.userId, (perUser.get(r.userId) ?? 0) + r.days);
  const over = [...perUser.entries()].find(([, d]) => d > 7);
  if (over) return NextResponse.json({ error: 'Nobody can work more than 7 days in a week.' }, { status: 422 });

  try {
    const userIds = [...perUser.keys()];
    const projectIds = [...new Set(rows.map(r => r.projectId).filter((x): x is string => !!x))];
    const [staff, owned] = await Promise.all([
      userIds.length ? db.select({ id: users.id, salaryPaise: users.salaryPaise }).from(users)
        .where(and(eq(users.tenantId, ctx.tenantId), inArray(users.id, userIds))) : [],
      projectIds.length ? db.select({ id: projects.id }).from(projects)
        .where(and(eq(projects.tenantId, ctx.tenantId), inArray(projects.id, projectIds))) : [],
    ]);
    if (staff.length !== userIds.length) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    if (owned.length !== projectIds.length) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const rate = new Map(staff.map(s => [s.id, Math.round(Number(s.salaryPaise ?? 0) / WORKING_DAYS)]));

    await db.transaction(async (tx) => {
      if (userIds.length) {
        await tx.delete(staffDayLogs).where(and(
          eq(staffDayLogs.tenantId, ctx.tenantId), eq(staffDayLogs.weekStart, weekStart), inArray(staffDayLogs.userId, userIds),
        ));
      }
      const values = rows.filter(r => r.days > 0).map(r => ({
        tenantId: ctx.tenantId, userId: r.userId, projectId: r.projectId, weekStart,
        days: String(r.days), dayRatePaise: rate.get(r.userId)!, costPaise: Math.round(rate.get(r.userId)! * r.days),
        createdBy: ctx.dbUserId,
      }));
      if (values.length) await tx.insert(staffDayLogs).values(values);
    });
    return NextResponse.json({ data: { saved: rows.filter(r => r.days > 0).length } });
  } catch (err) {
    return serverError('staff-days PUT', err);
  }
}
