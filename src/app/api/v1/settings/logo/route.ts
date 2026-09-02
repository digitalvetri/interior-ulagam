import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { putObject, getPublicUrl, QUOTES_BUCKET } from '@/lib/storage/s3';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * POST /api/v1/settings/logo
 * Accepts a multipart/form-data file upload in the `file` field.
 * Stores it in the public quotes bucket under `logos/<tenantId>.<ext>`
 * and persists the URL in tenants.brandingJson.logoUrl.
 */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can change the studio logo' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PNG, JPEG, WEBP, or SVG.' },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Logo must be under 2 MB' }, { status: 400 });
  }

  const ext = file.type === 'image/svg+xml' ? 'svg'
    : file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : 'jpg';

  const key = `logos/${ctx.tenantId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await putObject({
      bucket: QUOTES_BUCKET,
      key,
      body: buffer,
      contentType: file.type,
    });

    const logoUrl = getPublicUrl(QUOTES_BUCKET, key);

    // Persist in brandingJson
    const [existing] = await db
      .select({ brandingJson: tenants.brandingJson })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    const branding = { ...((existing?.brandingJson ?? {}) as Record<string, unknown>), logoUrl };
    await db.update(tenants).set({ brandingJson: branding }).where(eq(tenants.id, ctx.tenantId));

    return NextResponse.json({ data: { logoUrl } }, { status: 200 });
  } catch (e) {
    console.error('[POST /api/v1/settings/logo]', e);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
