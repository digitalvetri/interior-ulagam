import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expenses, projects } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    // Verify project belongs to this tenant
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.tenantId, ctx.tenantId)));

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.projectId, projectId), eq(expenses.tenantId, ctx.tenantId)))
      .orderBy(desc(expenses.createdAt));

    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[projects/:id/expenses GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
