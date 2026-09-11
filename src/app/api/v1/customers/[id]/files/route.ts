import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { customers } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { putObject, listObjects, deleteObject, getDownloadUrl, DOCUMENTS_BUCKET } from '@/lib/storage/s3';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

function prefix(customerId: string) {
  return `customers/${customerId}/`;
}

async function verifyCustomer(id: string, tenantId: string) {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

/* ── GET — list files ─────────────────────────────────────────────────────── */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  if (!await verifyCustomer(id, ctx.tenantId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const objects = await listObjects(prefix(id));
    const files = await Promise.all(objects.map(async (obj) => {
      const name = obj.key.slice(prefix(id).length);
      const url  = await getDownloadUrl({ key: obj.key, expiresIn: 3600, inline: true });
      return { key: obj.key, name, size: obj.size, lastModified: obj.lastModified.toISOString(), url };
    }));
    return NextResponse.json({ data: files });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

/* ── POST — upload file ───────────────────────────────────────────────────── */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  if (!await verifyCustomer(id, ctx.tenantId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File))
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 });

  if (!ALLOWED.has(file.type))
    return NextResponse.json({ error: 'File type not allowed' }, { status: 415 });

  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${prefix(id)}${Date.now()}_${safeFilename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await putObject({ bucket: DOCUMENTS_BUCKET, key, body: buffer, contentType: file.type });

  return NextResponse.json({ data: { key, name: file.name } }, { status: 201 });
}

/* ── DELETE — remove file ─────────────────────────────────────────────────── */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  if (!await verifyCustomer(id, ctx.tenantId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const key = new URL(req.url).searchParams.get('key');
  if (!key || !key.startsWith(prefix(id)))
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });

  await deleteObject(key);
  return NextResponse.json({ ok: true });
}
