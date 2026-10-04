import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { AiInput, INPUTS, RazorpayInput, WhatsAppInput, testAi, testRazorpay, testWhatsApp } from '@/lib/integrations/service';
import { checkRateLimit, integrationTestLimiter } from '@/lib/ratelimit';

/**
 * POST /api/v1/settings/integrations/[kind]/test — try the entered settings
 * against the real service before (or after) saving. Blank secret fields use
 * the saved values. Owner only; rate-limited because each run calls paid APIs.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;
  const limited = await checkRateLimit(integrationTestLimiter, request);
  if (limited) return limited;

  const { kind } = await params;
  if (kind !== 'ai' && kind !== 'whatsapp' && kind !== 'razorpay') {
    return NextResponse.json({ error: 'Unknown integration' }, { status: 404 });
  }
  const parsed = INPUTS[kind].safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings' }, { status: 422 });
  }

  const results =
    kind === 'ai' ? await testAi(parsed.data as z.infer<typeof AiInput>)
    : kind === 'whatsapp' ? await testWhatsApp(parsed.data as z.infer<typeof WhatsAppInput>)
    : await testRazorpay(parsed.data as z.infer<typeof RazorpayInput>);
  return NextResponse.json({ data: { ok: results.every((r) => r.ok), results } });
}
