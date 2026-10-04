import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';

/**
 * AES-256-GCM for integration API keys stored in the database.
 *
 * The key is derived (HKDF-SHA256) from BETTER_AUTH_SECRET, which the app and the
 * worker already share — so no new deployment secret is needed. Consequence:
 * rotating BETTER_AUTH_SECRET makes stored keys unreadable, and the owner has to
 * re-enter them in Settings → Integrations. There is deliberately no plaintext
 * fallback: a missing secret is an error.
 */
function key(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set — cannot encrypt integration keys.');
  return Buffer.from(hkdfSync('sha256', secret, 'konst-crm', 'integration-secrets-v1', 32));
}

/** Returns "v1:<iv>:<tag>:<ciphertext>" (base64 parts). */
export function encryptSecrets(secrets: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(secrets), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecrets(blob: string | null | undefined): Record<string, string> {
  if (!blob) return {};
  const [version, iv, tag, data] = blob.split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised integration secret format.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const json = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(json) as Record<string, string>;
}

/** What the browser may see of a secret: that it exists, and its last 4 characters. */
export function maskSecret(value: string | undefined): string | null {
  if (!value) return null;
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}
