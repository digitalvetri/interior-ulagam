import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export async function GET() {
  const timestamp = new Date().toISOString();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { status: 'degraded', database: 'unconfigured', timestamp },
      { status: 503 },
    );
  }

  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: 'ok', database: 'ok', timestamp });
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'unreachable',
        error: err instanceof Error ? err.message : 'unknown',
        timestamp,
      },
      { status: 503 },
    );
  }
}
