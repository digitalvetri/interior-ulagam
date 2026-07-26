import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

const ListQuery = z.object({
  parent: z.string().uuid().nullable().optional(),
  starred: z.enum(['true', 'false']).optional(),
});

// GET /api/v1/documents?parent=<uuid|null>&starred=true|false
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parentParam = request.nextUrl.searchParams.get('parent');
  const parsed = ListQuery.safeParse({
    parent: parentParam === 'null' || parentParam === '' ? null : parentParam ?? null,
    starred: request.nextUrl.searchParams.get('starred') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }

  try {
    const conditions = [eq(documents.tenantId, ctx.tenantId)];
    if (parsed.data.starred === 'true') {
      conditions.push(eq(documents.starred, true));
    } else {
      conditions.push(
        parsed.data.parent
          ? eq(documents.parentId, parsed.data.parent)
          : isNull(documents.parentId),
      );
    }

    const rows = await db
      .select()
      .from(documents)
      .where(and(...conditions))
      // folders first, then files, both by name
      .orderBy(desc(documents.kind), documents.name);

    return NextResponse.json({ data: rows });
  } catch (e) {
    console.error('[GET /api/v1/documents]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
