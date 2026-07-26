import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [project] = await db
      .select({ id: projects.id, tenantId: projects.tenantId })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const token = Buffer.from(`${project.id}:${project.tenantId}`).toString('base64url');
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/p/${token}`;

    return NextResponse.json({ data: { token, url } });
  } catch (err) {
    console.error('[projects/:id/client-token GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
