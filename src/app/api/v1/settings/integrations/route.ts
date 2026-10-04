import { NextResponse } from 'next/server';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { integrationStatus } from '@/lib/integrations/service';

/**
 * GET /api/v1/settings/integrations — what is connected, and from where
 * (saved in the app, server environment, or not at all). Owner-only.
 * Secrets never leave the server: only "set" plus the last 4 characters.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  return NextResponse.json({ data: await integrationStatus() });
}
