import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, siteVisits, users } from '@/lib/db/schema';
import { getAuthContext, requireApiRole, ROLES, type UserRole } from '@/lib/auth';
import { putObject, getPublicUrl, QUOTES_BUCKET, UploadRejected } from '@/lib/storage/s3';

/**
 * POST /api/v1/uploads/photos — one photo per request (multipart/form-data).
 *
 * Fields: file (File), scope ('site-visit' | 'snag' | 'employee'), entityId (UUID).
 * - site-visit → entityId is the site visit
 * - snag       → entityId is the project (the snag row doesn't exist yet)
 * - employee   → entityId is the employee (users row)
 *
 * Stored in the public-read bucket (same as avatars/logos) under an unguessable,
 * tenant-scoped key, because these URLs are persisted on rows and some are shown
 * to clients via magic links that carry no session. Returns { data: { url } }.
 */

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — client downscales well below this
// HEIC/HEIF deliberately excluded: Chrome/Android cannot render them in <img>.
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

const ScopeSchema = z.enum(['site-visit', 'snag', 'employee']);
type Scope = z.infer<typeof ScopeSchema>;

const ROLES_BY_SCOPE: Record<Scope, UserRole[]> = {
  'site-visit': ROLES.DELIVERY,
  snag:         ROLES.DELIVERY,
  employee:     ROLES.OWNER_ONLY,
};

async function entityExists(scope: Scope, entityId: string, tenantId: string): Promise<boolean> {
  if (scope === 'site-visit') {
    const [row] = await db.select({ id: siteVisits.id }).from(siteVisits)
      .where(and(eq(siteVisits.id, entityId), eq(siteVisits.tenantId, tenantId))).limit(1);
    return !!row;
  }
  if (scope === 'snag') {
    const [row] = await db.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, entityId), eq(projects.tenantId, tenantId))).limit(1);
    return !!row;
  }
  const [row] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, entityId), eq(users.tenantId, tenantId))).limit(1);
  return !!row;
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Coarse gate first; the per-scope check below narrows it.
  const deniedAny = requireApiRole(ctx, ROLES.DELIVERY);
  if (deniedAny) return deniedAny;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const scopeParsed = ScopeSchema.safeParse(formData.get('scope'));
  if (!scopeParsed.success) {
    return NextResponse.json({ error: 'Invalid upload scope' }, { status: 400 });
  }
  const scope = scopeParsed.data;

  const denied = requireApiRole(ctx, ROLES_BY_SCOPE[scope]);
  if (denied) return denied;

  const entityParsed = z.string().uuid().safeParse(formData.get('entityId'));
  if (!entityParsed.success) {
    return NextResponse.json({ error: 'entityId must be a valid UUID' }, { status: 400 });
  }
  const entityId = entityParsed.data;

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const contentType = file.type.split(';')[0].trim().toLowerCase();
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) {
    return NextResponse.json({ error: 'Only JPG, PNG or WEBP photos can be uploaded' }, { status: 422 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Photo is too large — maximum size is 10 MB' }, { status: 422 });
  }

  try {
    if (!(await entityExists(scope, entityId, ctx.tenantId))) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const key = `photos/${ctx.tenantId}/${scope}/${entityId}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject({ bucket: QUOTES_BUCKET, key, body: buffer, contentType });

    const url = getPublicUrl(QUOTES_BUCKET, key);
    return NextResponse.json({ data: { url } }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadRejected) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('[POST /api/v1/uploads/photos]', err);
    return NextResponse.json({ error: 'Upload failed — please try again' }, { status: 500 });
  }
}
