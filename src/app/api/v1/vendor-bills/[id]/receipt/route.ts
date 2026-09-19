import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { expenses } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { putObject, getDownloadUrl, DOCUMENTS_BUCKET } from '@/lib/storage/s3';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
]);
const EXT_MAP: Record<string, string> = {
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
  'application/pdf': 'pdf',
};

type Params = { params: Promise<{ id: string }> };

async function getBill(billId: string, tenantId: string) {
  const [row] = await db
    .select({ id: expenses.id, receiptUrl: expenses.receiptUrl, poId: expenses.poId })
    .from(expenses)
    .where(and(eq(expenses.id, billId), eq(expenses.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

// GET /api/v1/vendor-bills/[id]/receipt
// Generates a short-lived presigned URL and redirects (inline preview).
export async function GET(
  _req: NextRequest,
  { params }: Params,
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: 'Invalid bill id' }, { status: 400 });

  const bill = await getBill(id, ctx.tenantId);
  if (!bill)            return NextResponse.json({ error: 'Vendor bill not found' }, { status: 404 });
  if (!bill.receiptUrl) return NextResponse.json({ error: 'No receipt attached' },   { status: 404 });

  try {
    const url = await getDownloadUrl({ key: bill.receiptUrl, expiresIn: 600, inline: true });
    return NextResponse.redirect(url, { status: 302 });
  } catch {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }
}

// POST /api/v1/vendor-bills/[id]/receipt
// Uploads a receipt document. Stores the S3 key in expenses.receiptUrl.
// Fixed key per bill (overwrite replaces previous receipt).
export async function POST(
  req: NextRequest,
  { params }: Params,
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: 'Invalid bill id' }, { status: 400 });

  const bill = await getBill(id, ctx.tenantId);
  if (!bill)    return NextResponse.json({ error: 'Vendor bill not found' }, { status: 404 });
  if (!bill.poId) return NextResponse.json({ error: 'Not a vendor bill' },  { status: 400 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 }); }

  const file = formData.get('file');
  if (!(file instanceof File))
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });

  if (!ALLOWED.has(file.type))
    return NextResponse.json(
      { error: 'Unsupported file type. Use PDF, JPEG, PNG, or WEBP.' },
      { status: 415 },
    );

  const ext = EXT_MAP[file.type];
  const key = `vendor-receipts/${ctx.tenantId}/${id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await putObject({ bucket: DOCUMENTS_BUCKET, key, body: buffer, contentType: file.type });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  await db
    .update(expenses)
    .set({ receiptUrl: key })
    .where(and(eq(expenses.id, id), eq(expenses.tenantId, ctx.tenantId)));

  return NextResponse.json({ data: { key } }, { status: 201 });
}
