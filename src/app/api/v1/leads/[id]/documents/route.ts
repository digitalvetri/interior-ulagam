import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { getDownloadUrl } from '@/lib/storage/s3';

// ─── GET /api/v1/leads/[id]/documents ────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const rows = await db
      .select({
        id:          documents.id,
        tenantId:    documents.tenantId,
        leadId:      documents.leadId,
        kind:        documents.kind,
        name:        documents.name,
        mimeType:    documents.mimeType,
        sizeBytes:   documents.sizeBytes,
        storagePath: documents.storagePath,
        starred:     documents.starred,
        uploadedBy:  documents.uploadedBy,
        createdAt:   documents.createdAt,
      })
      .from(documents)
      .where(and(eq(documents.leadId, id), eq(documents.tenantId, ctx.tenantId)))
      .orderBy(desc(documents.createdAt));

    // The documents bucket is private, so each row gets its own short-lived
    // presigned link rather than a public URL.
    const rowsWithUrls = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        downloadUrl: row.storagePath
          ? await getDownloadUrl({ key: row.storagePath, expiresIn: 300, filename: row.name })
          : null,
      })),
    );

    return NextResponse.json({ data: rowsWithUrls });
  } catch (e) {
    console.error('[GET /api/v1/leads/[id]/documents]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
