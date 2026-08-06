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
    // Bounded retries: a genuinely unreachable Redis rejects rather than hanging
    // the request forever.
    maxRetriesPerRequest: 3,
    // The offline queue must stay ON. With it off, any command issued before the
    // socket finished connecting failed instantly with "Stream isn't writeable",
    // and since checkRateLimit fails open, rate limiting was silently skipped for
    // the first requests after every restart — the exact silent degradation the
    // Upstash setup was replaced to avoid. Queued commands flush on connect.
    enableOfflineQueue: true,
    lazyConnect: false,
  });

  cached.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
  });

  return cached;
}
