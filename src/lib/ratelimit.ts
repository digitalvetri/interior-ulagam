import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

/**
 * Sliding-window rate limiting backed by our own Redis (replaces Upstash).
 *
 * Limiters are created lazily: `next build` evaluates route modules while
 * collecting page data, and constructing a Redis-backed limiter at import time
 * would make a live Redis a build requirement.
 */
export interface Limiter {
  points: number;
  durationSec: number;
  keyPrefix: string;
}

// 10 login attempts per minute per IP
export const loginLimiter: Limiter = { points: 10, durationSec: 60, keyPrefix: 'rl:login' };

// 30 client-portal page loads per minute per IP (prevents token enumeration)
export const clientPortalLimiter: Limiter = { points: 30, durationSec: 60, keyPrefix: 'rl:portal' };

// 200 webhook calls per minute (bursts from Meta/Razorpay batches allowed)
export const webhookLimiter: Limiter = { points: 200, durationSec: 60, keyPrefix: 'rl:webhook' };

const instances = new Map<string, RateLimiterRedis>();

function resolve(limiter: Limiter): RateLimiterRedis | null {
  const existing = instances.get(limiter.keyPrefix);
  if (existing) return existing;

  const redis = getRedis();
  if (!redis) return null;

  const created = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: limiter.keyPrefix,
    points: limiter.points,
    duration: limiter.durationSec,
  });
  instances.set(limiter.keyPrefix, created);
  return created;
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'anonymous'
  );
}

/**
 * Returns a 429 response when the caller is over budget, otherwise null.
 *
 * Fails open if Redis is unreachable — a cache outage should not lock everyone
 * out of the product — but logs loudly rather than degrading silently, which is
 * how the previous Upstash setup ended up disabled without anyone noticing.
 */
export async function checkRateLimit(
  limiter: Limiter,
  request: NextRequest,
): Promise<NextResponse | null> {
  const instance = resolve(limiter);
  if (!instance) return null;

  try {
    await instance.consume(clientIp(request));
    return null;
  } catch (err) {
    if (err instanceof RateLimiterRes) {
      const retryAfterSec = Math.max(1, Math.ceil(err.msBeforeNext / 1000));
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limiter.points),
            'X-RateLimit-Remaining': String(err.remainingPoints),
            'X-RateLimit-Reset': String(Date.now() + err.msBeforeNext),
            'Retry-After': String(retryAfterSec),
          },
        },
      );
    }

    console.error(`[ratelimit] ${limiter.keyPrefix} check failed, allowing request:`, err);
    return null;
  }
}
