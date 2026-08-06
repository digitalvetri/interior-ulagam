import { randomBytes } from 'crypto';

// Ambiguous characters (0/O, 1/l/I) are excluded — these get read aloud and
// typed by hand when an owner hands a new account over.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * A single-use password for a newly created staff account. Better Auth requires
 * at least 8 characters; 16 keeps it well clear of a guessing attack for the
 * short window before the holder changes it.
 */
export function generateTemporaryPassword(length = 16): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
