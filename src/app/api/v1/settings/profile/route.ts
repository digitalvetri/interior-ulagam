import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

interface BrandingJson {
  studio?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  pan?: string;
  [k: string]: unknown;
}

const PatchSchema = z.object({
  studioName: z.string().min(1).max(200).optional(),
  tagline:    z.string().max(500).nullable().optional(),
  phone:      z.string().max(30).nullable().optional(),
  email:      z.string().email().nullable().optional().or(z.literal('')),
  address:    z.string().max(1000).nullable().optional(),
  gstin:      z.string().max(20).nullable().optional(),
  pan:        z.string().max(20).nullable().optional(),
});

// GET /api/v1/settings/profile — returns the current tenant's profile
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [row] = await db.select().from(tenants).where(eq(tenants.id, ctx.tenantId)).limit(1);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const branding = (row.brandingJson ?? {}) as BrandingJson;
  return NextResponse.json({
    data: {
      studioName: row.name,
      gstin:      row.gstin,
      tagline:    branding.tagline ?? null,
      phone:      branding.phone   ?? null,
      email:      branding.email   ?? null,
      address:    branding.address ?? null,
      pan:        branding.pan     ?? null,
    },
  });
}

// PATCH /api/v1/settings/profile
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() }, { status: 422 },
    );
  }

  const p = parsed.data;

  try {
    const [existing] = await db.select().from(tenants).where(eq(tenants.id, ctx.tenantId)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Studio name + GSTIN live on top-level columns; free-form profile bits go into brandingJson.
    const branding: BrandingJson = { ...((existing.brandingJson ?? {}) as BrandingJson) };
    if (p.tagline !== undefined) branding.tagline = p.tagline ?? undefined;
    if (p.phone   !== undefined) branding.phone   = p.phone ?? undefined;
    if (p.email   !== undefined) branding.email   = (p.email && p.email !== '' ? p.email : undefined);
    if (p.address !== undefined) branding.address = p.address ?? undefined;
    if (p.pan     !== undefined) branding.pan     = p.pan ?? undefined;

    const patch: Record<string, unknown> = { brandingJson: branding };
    if (p.studioName !== undefined) patch.name  = p.studioName;
    if (p.gstin      !== undefined) patch.gstin = p.gstin;

    const [row] = await db.update(tenants).set(patch).where(eq(tenants.id, ctx.tenantId)).returning();
    return NextResponse.json({
      data: {
        studioName: row.name,
        gstin:      row.gstin,
        tagline:    branding.tagline ?? null,
        phone:      branding.phone   ?? null,
        email:      branding.email   ?? null,
        address:    branding.address ?? null,
        pan:        branding.pan     ?? null,
      },
    });
  } catch (e) {
    console.error('[PATCH /api/v1/settings/profile]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
