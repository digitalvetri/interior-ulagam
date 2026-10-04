import { NextResponse } from 'next/server';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';

/**
 * Real connection status for each external service.
 *
 * The Settings tab previously rendered a hardcoded array in which WhatsApp,
 * Razorpay, Groq and Gemini were all permanently "Live" — including on
 * deployments where the app logged `GROQ_API_KEY is not set` at boot. Reading
 * the status from configuration means the page can only claim a service is
 * connected when it could actually reach it.
 *
 * Credentials themselves never leave the server; only whether each one is
 * present. Owner-only, because which integrations a studio has configured is
 * operational detail, not something every role needs.
 */
interface Integration {
  key: string;
  name: string;
  description: string;
  /** connected — every credential present. partial — some missing. absent — none. */
  status: 'connected' | 'partial' | 'absent';
  missing: string[];
  /** Where the user goes to act on it, when there is somewhere to go. */
  href?: string;
}

function has(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function evaluate(
  key: string,
  name: string,
  description: string,
  required: string[],
  href?: string,
): Integration {
  const missing = required.filter((n) => !has(n));
  const status: Integration['status'] =
    missing.length === 0 ? 'connected' : missing.length === required.length ? 'absent' : 'partial';
  return { key, name, description, status, missing, href };
}

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const data: Integration[] = [
    evaluate('whatsapp', 'WhatsApp Cloud API', 'Send templates and receive messages', [
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_VERIFY_TOKEN',
      'WHATSAPP_APP_SECRET',
    ]),
    evaluate('razorpay', 'Razorpay', 'Payment links, webhooks and reconciliation', [
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
    ]),
    evaluate('groq', 'Groq AI', 'Message parsing, Monday brief, BOQ drafting', ['GROQ_API_KEY']),
    evaluate('gemini', 'Gemini Flash', 'Site photo analysis', ['GOOGLE_AI_API_KEY']),
    evaluate('storage', 'Object storage', 'Documents, quote PDFs and site photos', [
      'S3_ENDPOINT',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
    ]),
    evaluate('redis', 'Redis', 'Background jobs and rate limiting', ['REDIS_URL']),
    // Tally needs no credentials — it is a file export, and it works today.
    {
      key: 'tally',
      name: 'Tally Prime',
      description: 'Export vouchers in Tally XML format',
      status: 'connected',
      missing: [],
      href: '/accounts',
    },
  ];

  return NextResponse.json({ data });
}
