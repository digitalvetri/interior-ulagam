import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { putObject, getDownloadUrl, DOCUMENTS_BUCKET } from '@/lib/storage/s3';

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// POST /api/v1/documents/upload
// FormData fields: file (File), leadId (UUID)
// Returns the created document row with a 5-minute presigned downloadUrl.
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const leadId = formData.get('leadId');
  if (!leadId || !z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: 'leadId is required and must be a valid UUID' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 415 });
  }

  // Verify the lead belongs to this tenant
  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, leadId as string), eq(leads.tenantId, ctx.tenantId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const safeFilename = file.name.replace(/[^a-zA-Z0-9._\- ]/g, '_');
  const storagePath = `leads/${leadId}/${Date.now()}_${safeFilename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await putObject({ bucket: DOCUMENTS_BUCKET, key: storagePath, body: buffer, contentType: file.type });
  } catch {
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 502 });
  }

  const [row] = await db
    .insert(documents)
    .values({
      tenantId:    ctx.tenantId,
      leadId:      leadId as string,
      kind:        'file',
      name:        file.name,
      mimeType:    file.type || null,
      sizeBytes:   file.size,
      storagePath,
      uploadedBy:  ctx.userId,
    })
    .returning();

  const downloadUrl = await getDownloadUrl({ key: storagePath, expiresIn: 300, filename: file.name }).catch(() => null);

  return NextResponse.json({
    data: {
      ...row,
      createdAt:   row.createdAt.toISOString(),
      downloadUrl,
    },
  }, { status: 201 });
}
