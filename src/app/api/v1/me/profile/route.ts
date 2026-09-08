import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/me/profile
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [user] = await db
      .select({
        id:               users.id,
        fullName:         users.fullName,
        email:            users.email,
        phone:            users.phone,
        role:             users.role,
        photoUrl:         users.photoUrl,
        jobTitle:         users.jobTitle,
        department:       users.department,
        location:         users.location,
        employmentType:   users.employmentType,
        hireDate:         users.hireDate,
        dob:              users.dob,
        emergencyContact: users.emergencyContact,
        status:           users.status,
      })
      .from(users)
      .where(and(eq(users.id, ctx.userId), eq(users.tenantId, ctx.tenantId)))
      .limit(1);

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ data: user });
  } catch (e) {
    console.error('[GET /api/v1/me/profile]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const UpdateProfileSchema = z.object({
  fullName:  z.string().min(1).max(200).optional(),
  phone:     z.string().max(20).optional().nullable(),
  photoUrl:  z.string().url().optional().nullable(),
  location:  z.string().max(200).optional().nullable(),
  emergencyContact: z.object({
    name:     z.string().min(1),
    relation: z.string().min(1),
    phone:    z.string().min(1),
  }).optional().nullable(),
});

// PATCH /api/v1/me/profile — update own profile fields
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.fullName  !== undefined) updates.fullName  = parsed.data.fullName;
  if (parsed.data.phone     !== undefined) updates.phone     = parsed.data.phone;
  if (parsed.data.photoUrl  !== undefined) updates.photoUrl  = parsed.data.photoUrl;
  if (parsed.data.location  !== undefined) updates.location  = parsed.data.location;
  if (parsed.data.emergencyContact !== undefined) {
    updates.emergencyContact = parsed.data.emergencyContact;
  }

  try {
    const [row] = await db
      .update(users)
      .set(updates)
      .where(and(eq(users.id, ctx.userId), eq(users.tenantId, ctx.tenantId)))
      .returning({
        id: users.id, fullName: users.fullName, email: users.email,
        phone: users.phone, role: users.role, photoUrl: users.photoUrl,
        jobTitle: users.jobTitle, department: users.department, location: users.location,
      });

    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[PATCH /api/v1/me/profile]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
