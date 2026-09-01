/**
 * Startup validation for configuration that must not be missing.
 *
 * Without this the app boots happily with no BETTER_AUTH_SECRET: it serves
 * pages, passes its health check, and only fails on the auth path — so a deploy
 * that forgot .env.local looks entirely healthy while nobody can sign in.
 *
 * Checked at module load in instrumentation.ts, which Next runs once per server
 * process before it handles any request.
 */
const REQUIRED = ['DATABASE_URL', 'BETTER_AUTH_SECRET'] as const;

// Not fatal, but each one silently disables a feature, so say so once at boot.
const RECOMMENDED: { name: string; disables: string }[] = [
  { name: 'REDIS_URL', disables: 'rate limiting and background jobs' },
  { name: 'S3_ENDPOINT', disables: 'document upload and download' },
  { name: 'S3_PUBLIC_URL', disables: 'quote PDF links' },
  { name: 'GROQ_API_KEY', disables: 'AI text and voice features' },
  { name: 'GOOGLE_AI_API_KEY', disables: 'AI image features' },
  { name: 'WHATSAPP_ACCESS_TOKEN', disables: 'all WhatsApp messaging' },
];

export function assertEnv(): void {
  const missing = REQUIRED.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    const message =
      `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      'Refusing to start — see .env.example. In Docker these come from .env.local, ' +
      'which docker-compose.yml declares as required.';
    console.error(`[env] ${message}`);
    // process.exit only available in Node.js runtime (not Edge); throw as fallback.
    if (typeof process !== 'undefined' && typeof process.exit === 'function') {
      process.exit(1);
    }
    throw new Error(message);
  }

  const absent = RECOMMENDED.filter((entry) => !process.env[entry.name]?.trim());
  for (const entry of absent) {
    console.warn(`[env] ${entry.name} is not set — ${entry.disables} will not work.`);
  }
}
