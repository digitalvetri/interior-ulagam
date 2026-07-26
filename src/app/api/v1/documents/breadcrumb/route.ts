import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// GET /api/v1/documents/breadcrumb?id=<uuid>
// Returns the ancestry chain from root → target as an ordered list.
export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ data: [] });
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const chain: { id: string; name: string }[] = [];
  let current: string | null = id;

  try {
    // Guard against pathological cycles (shouldn't happen, but be safe)
    for (let i = 0; i < 32 && current; i++) {
      const [row] = await db
        .select({ id: documents.id, name: documents.name, parentId: documents.parentId })
        .from(documents)
        .where(and(eq(documents.id, current), eq(documents.tenantId, ctx.tenantId)))
        .limit(1);
      if (!row) break;
      chain.unshift({ id: row.id, name: row.name });
      current = row.parentId;
    }
    return NextResponse.json({ data: chain });
  } catch (e) {
    console.error('[GET /api/v1/documents/breadcrumb]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
