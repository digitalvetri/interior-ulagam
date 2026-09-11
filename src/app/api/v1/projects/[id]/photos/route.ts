import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, siteLogs } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { putObject, getDownloadUrl } from '@/lib/storage/s3';

const MAX_FILE_SIZE  = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES  = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_FILES      = 20;
const PRESIGN_EXPIRY = 604800; // 7 days

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

  const photoUrls: string[] = [];

  for (const file of files.slice(0, MAX_FILES)) {
    if (!ALLOWED_TYPES.has(file.type)) continue;
    if (file.size > MAX_FILE_SIZE) continue;

    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `projects/${projectId}/photos/${Date.now()}_${safeFilename}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await putObject({ key, body: buffer, contentType: file.type });
    const url = await getDownloadUrl({ key, expiresIn: PRESIGN_EXPIRY, inline: true });
    photoUrls.push(url);
  }

  if (!photoUrls.length) {
    return NextResponse.json({ error: 'No valid image files uploaded' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0];
  const [siteLog] = await db
    .insert(siteLogs)
    .values({
      tenantId:  ctx.tenantId,
      projectId,
      logDate:   today,
      photos:    photoUrls,
      source:    'manual',
    })
    .returning({ id: siteLogs.id });

  return NextResponse.json({ data: { siteLogId: siteLog.id, photoUrls } }, { status: 201 });
}
