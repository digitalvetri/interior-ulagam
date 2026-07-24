import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { projects, clientTokens } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Tokens are valid for 30 days. Owners can revoke via DELETE.
const TOKEN_TTL_DAYS = 30;

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

    // Revoke any existing non-expired token for this project before issuing a new one.
    await db
      .update(clientTokens)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(clientTokens.projectId, project.id),
          eq(clientTokens.tenantId, ctx.tenantId),
        ),
      );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

    await db.insert(clientTokens).values({
      tenantId: ctx.tenantId,
      projectId: project.id,
      token,
      expiresAt,
    });

    const url = `${process.env.NEXT_PUBLIC_APP_URL}/p/${token}`;
    return NextResponse.json({ data: { token, url, expiresAt: expiresAt.toISOString() } });
  } catch (err) {
    console.error('[projects/:id/client-token GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Revoke the active share link for this project.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (ctx.role !== 'owner' && ctx.role !== 'designer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    await db
      .update(clientTokens)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(clientTokens.projectId, id),
          eq(clientTokens.tenantId, ctx.tenantId),
        ),
      );

    return NextResponse.json({ data: { revoked: true } });
  } catch (err) {
    console.error('[projects/:id/client-token DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
