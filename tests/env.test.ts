import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';

/**
 * The app must refuse to start without these. Booting without
 * BETTER_AUTH_SECRET produced a server that served pages and passed its health
 * check while authentication was dead — the failure mode this guards against.
 */
describe('assertEnv', () => {
  const original = { ...process.env };
  let exitSpy: MockInstance<(code?: string | number | null) => never>;
  let errorSpy: MockInstance<(...args: unknown[]) => void>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as typeof errorSpy;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...original };
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('exits when BETTER_AUTH_SECRET is missing', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/x';
    delete process.env.BETTER_AUTH_SECRET;

    const { assertEnv } = await import('../src/lib/env');
    assertEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy.mock.calls.flat().join(' ')).toContain('BETTER_AUTH_SECRET');
  });

  it('exits when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);

    const { assertEnv } = await import('../src/lib/env');
    assertEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('treats whitespace as missing', async () => {
    process.env.DATABASE_URL = '   ';
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);

    const { assertEnv } = await import('../src/lib/env');
    assertEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('starts when both are present', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/x';
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);

    const { assertEnv } = await import('../src/lib/env');
    assertEnv();

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
