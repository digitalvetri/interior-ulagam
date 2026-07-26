import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase/service';

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  starred: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

async function fetchOne(id: string, tenantId: string) {
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

// GET /api/v1/documents/:id (metadata)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const row = await fetchOne(id, ctx.tenantId);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: row });
}

// PATCH /api/v1/documents/:id (rename, star, move)
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
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() }, { status: 422 },
    );
  }

  const existing = await fetchOne(id, ctx.tenantId);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Prevent moving a folder into itself or its descendants
  if (parsed.data.parentId !== undefined && parsed.data.parentId === id) {
    return NextResponse.json({ error: 'Cannot move into itself' }, { status: 400 });
  }
  if (parsed.data.parentId) {
    const [parent] = await db
      .select({ id: documents.id, kind: documents.kind })
      .from(documents)
      .where(and(eq(documents.id, parsed.data.parentId), eq(documents.tenantId, ctx.tenantId)))
      .limit(1);
    if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    if (parent.kind !== 'folder') return NextResponse.json({ error: 'Parent is not a folder' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined)     patch.name = parsed.data.name.trim();
  if (parsed.data.starred !== undefined)  patch.starred = parsed.data.starred;
  if (parsed.data.parentId !== undefined) patch.parentId = parsed.data.parentId;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const [row] = await db
      .update(documents)
      .set(patch)
      .where(and(eq(documents.id, id), eq(documents.tenantId, ctx.tenantId)))
      .returning();
    return NextResponse.json({ data: row });
  } catch (e) {
    console.error('[PATCH /api/v1/documents/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/v1/documents/:id — for folders, ON DELETE CASCADE removes children rows;
// for files (and any file descendants of a folder), delete the storage objects too.
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

  const target = await fetchOne(id, ctx.tenantId);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Collect all file storage paths under this subtree (recursive descent through parent_id)
  const filePaths: string[] = [];
  const stack = [target];
  const seen = new Set<string>([target.id]);
  while (stack.length) {
    const node = stack.pop()!;
    if (node.kind === 'file' && node.storagePath) filePaths.push(node.storagePath);
    if (node.kind === 'folder') {
      const children = await db
        .select()
        .from(documents)
        .where(and(eq(documents.parentId, node.id), eq(documents.tenantId, ctx.tenantId)));
      for (const c of children) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        stack.push(c);
      }
    }
  }

  try {
    if (filePaths.length) {
      const supa = getServiceClient();
      const { error: rmErr } = await supa.storage.from('documents').remove(filePaths);
      if (rmErr) console.warn('[documents delete] storage remove warning:', rmErr.message);
    }

    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.tenantId, ctx.tenantId)));
    return NextResponse.json({ data: { id, removedFiles: filePaths.length } });
  } catch (e) {
    console.error('[DELETE /api/v1/documents/:id]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
