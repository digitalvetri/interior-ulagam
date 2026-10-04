import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getRedis } from '@/lib/redis';

/**
 * Liveness probe. Docker restarts the container on a failure here, and the
 * production compose file gates the app on it.
 *
 * It previously ran `SELECT 1` and nothing else, so it reported healthy while
 * Redis was down and every background job was dead. Each dependency is now
 * probed and reported separately: Postgres is fatal because nothing works
 * without it, while Redis and object storage are degraded-but-serving, since
 * losing them disables features rather than the application.
 */
export const dynamic = 'force-dynamic';

type Check = 'ok' | 'down' | 'not_configured';

async function checkPostgres(): Promise<Check> {
  try {
    await db.execute(sql`SELECT 1`);
    return 'ok';
  } catch {
    return 'down';
  }
}

async function checkRedis(): Promise<Check> {
  const redis = getRedis();
  if (!redis) return 'not_configured';
  try {
    await redis.ping();
    return 'ok';
  } catch {
    return 'down';
  }
}

async function checkStorage(): Promise<Check> {
  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) return 'not_configured';
  try {
    // A HEAD against the service root: cheap, and it needs no bucket rights.
    const res = await fetch(endpoint, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2_000),
    });
    // Any HTTP answer means the service is listening; 403 is a normal
    // unauthenticated reply from S3-compatible endpoints.
    return res.status > 0 ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

export async function GET() {
  const [postgres, redis, storage] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkStorage(),
  ]);

  const healthy = postgres === 'ok';
  const degraded = redis === 'down' || storage === 'down';

  return NextResponse.json(
    {
      status: !healthy ? 'error' : degraded ? 'degraded' : 'ok',
      checks: { postgres, redis, storage },
      timestamp: new Date().toISOString(),
    },
    // Only Postgres being unreachable is worth restarting the container over.
    { status: healthy ? 200 : 503 },
  );
}
