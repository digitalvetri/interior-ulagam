import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { designTasks } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const StatusEnum = z.enum(['todo', 'in_progress', 'review', 'done']);
const PriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  projectId: z.string().uuid().optional(),
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  dueDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const status = request.nextUrl.searchParams.get('status');
  const parsed = status ? StatusEnum.safeParse(status) : null;
  if (parsed && !parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    const conditions = [eq(designTasks.tenantId, ctx.tenantId)];
    if (parsed?.success) conditions.push(eq(designTasks.status, parsed.data));
    if (q) {
      const like = `%${q}%`;
      const search = or(ilike(designTasks.title, like), ilike(designTasks.description, like));
      if (search) conditions.push(search);
    }
    const rows = await db
      .select()
      .from(designTasks)
      .where(and(...conditions))
      .orderBy(asc(designTasks.dueDate), desc(designTasks.createdAt))
      .limit(500);
    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/design-tasks]', e);
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
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
      .insert(designTasks)
      .values({
        tenantId: ctx.tenantId,
        projectId: p.projectId ?? null,
        title: p.title,
        description: p.description ?? null,
        status: p.status ?? 'todo',
        priority: p.priority ?? 'normal',
        dueDate: p.dueDate ?? null,
      })
      .returning();
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/design-tasks]', e);
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
