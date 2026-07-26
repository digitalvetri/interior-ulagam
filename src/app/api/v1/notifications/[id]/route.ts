import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const PatchSchema = z.object({
  read: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error' }, { status: 422 });
  }

  try {
    const [row] = await db
      .update(notifications)
      .set({ readAt: parsed.data.read === false ? null : new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.tenantId, ctx.tenantId)))
      .returning();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[PATCH /api/v1/notifications/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  try {
    const [row] = await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.tenantId, ctx.tenantId)))
      .returning({ id: notifications.id });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: { id: row.id } });
  } catch (e) {
    console.error('[DELETE /api/v1/notifications/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
