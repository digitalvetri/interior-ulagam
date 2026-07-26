import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const CreateSchema = z.object({
  severity: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
  href: z.string().max(500).optional(),
});

// GET /api/v1/notifications?unread=true
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true';

  try {
    const conditions = [eq(notifications.tenantId, ctx.tenantId)];
    if (unreadOnly) conditions.push(isNull(notifications.readAt));

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(200);

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/notifications]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/v1/notifications (test/create)
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

  const [row] = await db
    .insert(notifications)
    .values({
      tenantId: ctx.tenantId,
      severity: parsed.data.severity,
      title: parsed.data.title,
      body: parsed.data.body ?? null,
      href: parsed.data.href ?? null,
    })
    .returning();

  return NextResponse.json({ data: row }, { status: 201 });
}

// POST /api/v1/notifications/mark-all-read → implemented via PATCH here.
export async function PATCH(_request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.tenantId, ctx.tenantId), isNull(notifications.readAt)));
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error('[PATCH /api/v1/notifications]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
