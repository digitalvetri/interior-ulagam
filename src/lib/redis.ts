import Redis from 'ioredis';

/**
 * Shared Redis connection — used for rate limiting today, and for the BullMQ
 * job queue in a later phase. Replaces the hosted Upstash instance.
 */
let cached: Redis | null = null;

export function getRedis(): Redis | null {
  if (cached) return cached;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn('[redis] REDIS_URL is not set — features backed by Redis are disabled.');
    return null;
  }

  cached = new Redis(url, {
    // Fail fast rather than queueing commands forever if Redis is unreachable;
    // callers decide what to do when a command rejects.
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: false,
  });

  cached.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
  });

  return cached;
}
