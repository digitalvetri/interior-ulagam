import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { portfolios } from '@/lib/db/schema';
import { getEnrichedAuthContext } from '@/lib/auth/get-context';

const UpdateSchema = z.object({
  title:         z.string().max(200).optional(),
  coverPhotoUrl: z.string().url().nullable().optional(),
  photos:        z.array(z.string().url()).optional(),
  isPublic:      z.boolean().optional(),
  clientConsent: z.boolean().optional(),
});

async function resolvePortfolio(tenantId: string, id: string) {
  const [row] = await db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, id), eq(portfolios.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

// GET /api/v1/portfolio/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const row = await resolvePortfolio(ctx.tenantId, id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: row });
}

// PATCH /api/v1/portfolio/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const row = await resolvePortfolio(ctx.tenantId, id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const updates: Partial<typeof portfolios.$inferInsert> = {};
  const d = parsed.data;
  if (d.title         !== undefined) updates.title         = d.title;
  if (d.coverPhotoUrl !== undefined) updates.coverPhotoUrl = d.coverPhotoUrl;
  if (d.photos        !== undefined) updates.photos        = d.photos;
  if (d.isPublic      !== undefined) updates.isPublic      = d.isPublic;
  if (d.clientConsent !== undefined) updates.clientConsent = d.clientConsent;

  if (Object.keys(updates).length === 0) return NextResponse.json({ data: row });

  const [updated] = await db
    .update(portfolios)
    .set(updates)
    .where(eq(portfolios.id, id))
    .returning();

  return NextResponse.json({ data: updated });
}

// DELETE /api/v1/portfolio/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getEnrichedAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const row = await resolvePortfolio(ctx.tenantId, id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(portfolios).where(eq(portfolios.id, id));
  return NextResponse.json({ data: { id } });
}
