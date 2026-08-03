import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, accounts } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const RoleEnum = z.enum(['owner', 'designer', 'supervisor', 'accountant']);
const EmpTypeEnum = z.enum(['full_time', 'part_time', 'contract', 'intern', 'consultant']);

const CreateSchema = z.object({
  fullName: z.string().min(1).max(120),
  role: RoleEnum.default('designer'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  jobTitle: z.string().max(120).optional(),
  department: z.string().max(80).optional(),
  location: z.string().max(80).optional(),
  employmentType: EmpTypeEnum.optional(),
  hireDate: z.string().optional(),           // yyyy-mm-dd
  dob: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal('')),
  managerId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const dept = request.nextUrl.searchParams.get('department') ?? '';
  const type = request.nextUrl.searchParams.get('employmentType');

  try {
    const conditions = [eq(users.tenantId, ctx.tenantId)];
    if (dept)             conditions.push(eq(users.department, dept));
    if (type && EmpTypeEnum.safeParse(type).success) {
      conditions.push(eq(users.employmentType, type as z.infer<typeof EmpTypeEnum>));
    }
    if (q) {
      const like = `%${q}%`;
      const search = or(
        ilike(users.fullName, like),
        ilike(users.email, like),
        ilike(users.phone, like),
        ilike(users.jobTitle, like),
        ilike(users.department, like),
      );
      if (search) conditions.push(search);
    }

    const rows = await db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt))
      .limit(500);

    // Who can actually sign in — i.e. Better Auth holds a credential for them.
    // Replaces the old supabaseUid check. Done as a second query against the
    // ids we just fetched rather than a correlated subquery, which keeps the
    // generated SQL obvious.
    const credentialled = rows.length
      ? await db
          .selectDistinct({ userId: accounts.userId })
          .from(accounts)
          .where(inArray(accounts.userId, rows.map((r) => r.id)))
      : [];
    const withLogin = new Set(credentialled.map((a) => a.userId));

    return NextResponse.json({
      data: rows.map((r) => ({ ...r, hasLogin: withLogin.has(r.id) })),
    });
  } catch (e) {
    console.error('[GET /api/v1/employees]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() }, { status: 422 },
    );
  }
  const p = parsed.data;

  try {
    const [row] = await db
      .insert(users)
      .values({
        tenantId: ctx.tenantId,
        fullName: p.fullName,
        role: p.role,
        email: p.email && p.email !== '' ? p.email : null,
        phone: p.phone ?? null,
        jobTitle: p.jobTitle ?? null,
        department: p.department ?? null,
        location: p.location ?? null,
        employmentType: p.employmentType ?? null,
        hireDate: p.hireDate ?? null,
        dob: p.dob ?? null,
        photoUrl: p.photoUrl && p.photoUrl !== '' ? p.photoUrl : null,
        managerId: p.managerId ?? null,
      })
      .returning();
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/employees]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
