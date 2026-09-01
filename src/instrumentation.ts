import { assertEnv } from '@/lib/env';

export async function register() {
  assertEnv();
}
