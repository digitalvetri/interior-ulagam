/**
 * Next runs this once per server process, before any request is handled.
 * Used to fail fast on missing configuration.
 */
export async function register(): Promise<void> {
  // Only the Node.js server runtime has process.env and can meaningfully exit.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertEnv } = await import('@/lib/env');
  assertEnv();
}
