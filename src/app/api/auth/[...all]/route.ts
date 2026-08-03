import { auth } from '@/lib/auth/config';
import { toNextJsHandler } from 'better-auth/next-js';

// Better Auth's own endpoints (session, sign-out, etc.) live under /api/auth/*.
export const { GET, POST } = toNextJsHandler(auth.handler);
