import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users, accounts } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { auth } from '@/lib/auth/config';
import { generateTemporaryPassword } from '@/lib/auth/temp-password';

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
  // Creating staff — and, with an email, issuing them a login — is an owner-only
  // action. Any signed-in user could do this previously.
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Only an owner can add employees.' }, { status: 403 });
  }

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
  const email = p.email && p.email !== '' ? p.email : null;

  // Fields that are ours rather than Better Auth's, applied either way.
  const profile = {
    role: p.role,
    phone: p.phone ?? null,
    jobTitle: p.jobTitle ?? null,
    department: p.department ?? null,
    location: p.location ?? null,
    employmentType: p.employmentType ?? null,
    hireDate: p.hireDate ?? null,
    dob: p.dob ?? null,
    photoUrl: p.photoUrl && p.photoUrl !== '' ? p.photoUrl : null,
    managerId: p.managerId ?? null,
  };

  try {
    // No email — a directory record only. Plenty of site staff never sign in.
    if (!email) {
      const [row] = await db
        .insert(users)
        .values({ tenantId: ctx.tenantId, fullName: p.fullName, email: null, ...profile })
        .returning();
      return NextResponse.json({ data: { ...row, hasLogin: false } }, { status: 201 });
    }

    const [clash] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (clash) {
      return NextResponse.json(
        { error: 'An account with that email already exists.' },
        { status: 409 },
      );
    }

    // Better Auth owns the users row when there is a login, so it creates the
    // record and we patch our columns on top. Doing our own insert first would
    // collide with it on the unique email.
    const temporaryPassword = generateTemporaryPassword();
    await auth.api.signUpEmail({
      body: { name: p.fullName, email, password: temporaryPassword },
    });

    const [row] = await db
      .update(users)
      .set(profile)
      .where(and(eq(users.email, email), eq(users.tenantId, ctx.tenantId)))
      .returning();

    // The password is returned exactly once, for the owner to hand over. It is
    // never stored in readable form and cannot be retrieved again — there is no
    // mail transport configured to send it instead.
    return NextResponse.json(
      { data: { ...row, hasLogin: true }, temporaryPassword },
      { status: 201 },
    );
  } catch (e) {
    console.error('[POST /api/v1/employees]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
