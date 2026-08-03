import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { getDownloadUrl } from '@/lib/storage/s3';

// GET /api/v1/documents/:id/download — returns a signed URL (5 min)
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

  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.tenantId, ctx.tenantId)))
    .limit(1);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.kind !== 'file' || !row.storagePath) {
    return NextResponse.json({ error: 'Not a file' }, { status: 400 });
  }

  try {
    const url = await getDownloadUrl({
      key: row.storagePath,
      expiresIn: 300,
      filename: row.name,
    });
    return NextResponse.json({ data: { url, name: row.name } });
  } catch (e) {
    console.error('[GET /api/v1/documents/:id/download]', e);
    return NextResponse.json({ error: 'Failed to sign URL' }, { status: 500 });
  }
}
