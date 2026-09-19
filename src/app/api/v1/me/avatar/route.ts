import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { putObject, getPublicUrl, QUOTES_BUCKET } from '@/lib/storage/s3';
import { and, eq } from 'drizzle-orm';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES  = new Set(['image/jpeg', 'image/jpg', 'image/png']);

// POST /api/v1/me/avatar — upload/replace profile picture
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Only JPG and PNG files are allowed' },
      { status: 422 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File is too large — maximum size is 5 MB' },
      { status: 422 },
    );
  }

  try {
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    // Deterministic key per user — overwrites the previous avatar automatically.
    const key = `avatars/${ctx.tenantId}/${ctx.userId}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject({ bucket: QUOTES_BUCKET, key, body: buffer, contentType: file.type });

    const photoUrl = getPublicUrl(QUOTES_BUCKET, key);

    await db
      .update(users)
      .set({ photoUrl, updatedAt: new Date() })
      .where(and(eq(users.id, ctx.userId), eq(users.tenantId, ctx.tenantId)));

    return NextResponse.json({ data: { photoUrl } }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/v1/me/avatar]', err);
    return NextResponse.json({ error: 'Upload failed — please try again' }, { status: 500 });
  }
}
