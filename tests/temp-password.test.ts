import { describe, it, expect } from 'vitest';
import { generateTemporaryPassword } from '../src/lib/auth/temp-password';

describe('generateTemporaryPassword', () => {
  it('meets Better Auth’s minimum length', () => {
    expect(generateTemporaryPassword().length).toBeGreaterThanOrEqual(8);
  });

  it('honours a requested length', () => {
    expect(generateTemporaryPassword(24)).toHaveLength(24);
  });

  it('never emits characters that are ambiguous when read aloud', () => {
    // These accounts are handed over verbally or on paper, so 0/O and 1/l/I
    // would generate support calls.
    const sample = Array.from({ length: 200 }, () => generateTemporaryPassword()).join('');
    expect(sample).not.toMatch(/[0O1lI]/);
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateTemporaryPassword()));
    expect(seen.size).toBe(500);
  });
});
