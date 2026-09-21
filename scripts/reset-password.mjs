/**
 * Resets a user's password directly in the database.
 * Handles both cases: user has an existing accounts row (updates it) and
 * user was created via the employees module without Better Auth (inserts one).
 *
 * Uses the same hashing algorithm Better Auth uses: scrypt via Node's built-in
 * crypto module (N=16384, r=16, p=1, dkLen=64), format: "<salt_hex>:<key_hex>"
 *
 * Usage (from repo root):
 *   node scripts/reset-password.mjs <email> <newPassword>
 *
 * Example:
 *   node scripts/reset-password.mjs Mohasher11@gmail.com "KonstDesign@2026"
 */

import { scryptSync, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const [, , email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error('Usage: node scripts/reset-password.mjs <email> <newPassword>');
  process.exit(1);
}

// ── Load DATABASE_URL from .env.local ─────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');

let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DATABASE_URL=')) {
        DATABASE_URL = trimmed.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '');
        break;
      }
    }
  } catch {
    // .env.local missing
  }
}

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL not found in .env.local or environment.');
  process.exit(1);
}

// ── Hash the password using the same algorithm as Better Auth ────────────────
// Better Auth: scryptAsync(password.normalize("NFKC"), saltHexString, {N:16384, r:16, p:1, dkLen:64})
// Both password and salt are passed as UTF-8 strings to the KDF (not raw bytes).
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex'); // 32-char hex string — matches Better Auth's format
  const key = scryptSync(password.normalize('NFKC'), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 64 * 1024 * 1024 });
  return `${salt}:${key.toString('hex')}`;
}

// ── Connect and update ────────────────────────────────────────────────────────
const sql = postgres(DATABASE_URL);

try {
  // Find the user
  const [user] = await sql`
    SELECT id FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1
  `;

  if (!user) {
    console.error(`❌  No user found with email: ${email}`);
    process.exit(1);
  }

  const userId = user.id;
  console.log(`✅  Found user: ${userId}`);

  const hash = hashPassword(newPassword);

  // Check for existing credential account row
  const [existing] = await sql`
    SELECT id FROM accounts WHERE user_id = ${userId} AND provider_id = 'credential' LIMIT 1
  `;

  if (existing) {
    await sql`
      UPDATE accounts
      SET password = ${hash}, updated_at = NOW()
      WHERE id = ${existing.id}
    `;
    console.log(`✅  Password updated for ${email}`);
  } else {
    // No accounts row — user was created via employees module without Better Auth.
    // Insert one so they can now sign in.
    await sql`
      INSERT INTO accounts (user_id, account_id, provider_id, password, created_at, updated_at)
      VALUES (${userId}, ${email.toLowerCase()}, 'credential', ${hash}, NOW(), NOW())
    `;
    console.log(`✅  Login account created for ${email} (was previously employees-only)`);
  }

  console.log(`\nUser ${email} can now log in with the new password.`);
} finally {
  await sql.end();
}
