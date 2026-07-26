import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

function makeRatelimit(tokens: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(tokens, window),
  });
}

// 10 login attempts per minute per IP
export const loginLimiter = makeRatelimit(10, '1 m');

// 30 client-portal page loads per minute per IP (prevents token enumeration)
export const clientPortalLimiter = makeRatelimit(30, '1 m');

// 200 webhook calls per minute (per IP — bursts from Meta/Razorpay batches allowed)
export const webhookLimiter = makeRatelimit(200, '1 m');

export async function checkRateLimit(
  limiter: Ratelimit | null,
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!limiter) return null; // env not configured — allow through

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
  const { success, limit, remaining, reset } = await limiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        },
      },
    );
  }
  return null;
}
