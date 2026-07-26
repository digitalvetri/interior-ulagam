import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const BodySchema = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
});

// POST /api/v1/documents/folder
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // If parentId is provided, make sure it's a folder in this tenant
  if (parsed.data.parentId) {
    const [parent] = await db
      .select({ id: documents.id, kind: documents.kind })
      .from(documents)
      .where(and(
        eq(documents.id, parsed.data.parentId),
        eq(documents.tenantId, ctx.tenantId),
      ))
      .limit(1);
    if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    if (parent.kind !== 'folder') {
      return NextResponse.json({ error: 'Parent is not a folder' }, { status: 400 });
    }
  }

  try {
    const [row] = await db
      .insert(documents)
      .values({
        tenantId: ctx.tenantId,
        parentId: parsed.data.parentId ?? null,
        kind: 'folder',
        name: parsed.data.name.trim(),
      })
      .returning();
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/documents/folder]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
