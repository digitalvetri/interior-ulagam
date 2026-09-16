/**
 * One-shot: reset a credential-account password in the DB.
 * Matches exactly the hashing used by @better-auth/utils@0.4.x (password.node.mjs).
 *
 * Usage:
 *   $env:DATABASE_URL="postgres://..."; node scripts/reset-owner-password.mjs <email> <new-password>
 */

import crypto from 'crypto';
import postgres from 'postgres';

const [, , email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error('Usage: node scripts/reset-owner-password.mjs <email> <new-password>');
  process.exit(1);
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL before running this script.');
  process.exit(1);
}

// Exact match of @better-auth/utils password.node.mjs
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const normalized = password.normalize('NFKC');
    crypto.scrypt(normalized, salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

const sql = postgres(DATABASE_URL);

const hash = await hashPassword(newPassword);

const rows = await sql`
  UPDATE accounts SET password = ${hash}, updated_at = NOW()
  WHERE account_id = ${email} AND provider_id = 'credential'
  RETURNING user_id, account_id
`;

if (rows.length === 0) {
  console.error(`No credential account found for: ${email}`);
  await sql.end();
  process.exit(1);
}

console.log(`Password reset successfully for ${email}`);
await sql.end();
