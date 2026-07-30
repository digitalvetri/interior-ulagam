import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase/service';

const MAX_BYTES = 50 * 1024 * 1024; // matches bucket cap

// POST /api/v1/documents/upload
// multipart/form-data: file=<File>, parentId=<uuid|""|"null">
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });

  const file = form.get('file');
  const parentRaw = form.get('parentId');
  const parentId = typeof parentRaw === 'string' && parentRaw && parentRaw !== 'null' ? parentRaw : null;
  const leadRaw  = form.get('leadId');
  const leadId   = typeof leadRaw === 'string' && leadRaw && leadRaw !== 'null' ? leadRaw : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File exceeds ${MAX_BYTES / 1024 / 1024} MB limit` }, { status: 413 });
  }

  if (parentId) {
    const [parent] = await db
      .select({ id: documents.id, kind: documents.kind })
      .from(documents)
      .where(and(eq(documents.id, parentId), eq(documents.tenantId, ctx.tenantId)))
      .limit(1);
    if (!parent) return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    if (parent.kind !== 'folder') return NextResponse.json({ error: 'Parent is not a folder' }, { status: 400 });
  }

  const supa = getServiceClient();

  // Insert the DB row first so we get an id to embed in the storage path.
  const [row] = await db
    .insert(documents)
    .values({
      tenantId: ctx.tenantId,
      parentId,
      leadId,
      kind: 'file',
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      storagePath: '',
    })
    .returning();

  const storagePath = `${ctx.tenantId}/${row.id}/${sanitize(file.name)}`;

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supa
      .storage
      .from('documents')
      .upload(storagePath, buf, { contentType: row.mimeType ?? undefined, upsert: false });
    if (upErr) throw upErr;

    // Patch the row with the final path
    const [updated] = await db
      .update(documents)
      .set({ storagePath })
      .where(and(eq(documents.id, row.id), eq(documents.tenantId, ctx.tenantId)))
      .returning();

    return NextResponse.json({ data: updated }, { status: 201 });
  } catch (e) {
    console.error('[POST /api/v1/documents/upload]', e);
    // Roll back the DB row so we don't leak orphans
    await db.delete(documents).where(and(eq(documents.id, row.id), eq(documents.tenantId, ctx.tenantId)));
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

function sanitize(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(0, 200);
}
