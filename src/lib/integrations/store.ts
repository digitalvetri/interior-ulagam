import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { integrationSettings, tenants } from '@/lib/db/schema';
import { decryptSecrets, encryptSecrets } from './crypto';

export type IntegrationKind = 'ai' | 'whatsapp' | 'razorpay';
export const INTEGRATION_KINDS: IntegrationKind[] = ['ai', 'whatsapp', 'razorpay'];

export interface StoredIntegration {
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  updatedAt: Date;
}

// Short per-process cache: the app clears it on save; the worker (a separate
// process) picks a change up within the TTL.
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: StoredIntegration | null }>();

export function clearIntegrationCache(): void {
  cache.clear();
}

/**
 * This deployment serves one studio. Webhooks and background jobs often have no
 * tenant in hand, so they resolve the (only) tenant here.
 */
export async function defaultTenantId(): Promise<string | null> {
  const [t] = await db.select({ id: tenants.id }).from(tenants).orderBy(asc(tenants.createdAt)).limit(1);
  return t?.id ?? null;
}

export async function getIntegration(kind: IntegrationKind, tenantId?: string | null): Promise<StoredIntegration | null> {
  const tid = tenantId ?? (await defaultTenantId());
  if (!tid) return null;
  const cacheKey = `${tid}:${kind}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const [row] = await db
    .select({ config: integrationSettings.config, secretsEnc: integrationSettings.secretsEnc, updatedAt: integrationSettings.updatedAt })
    .from(integrationSettings)
    .where(and(eq(integrationSettings.tenantId, tid), eq(integrationSettings.kind, kind)))
    .limit(1);

  const value: StoredIntegration | null = row
    ? { config: (row.config ?? {}) as Record<string, unknown>, secrets: decryptSecrets(row.secretsEnc), updatedAt: row.updatedAt }
    : null;
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

/**
 * Save a connection. `secretsPatch`: a non-empty string replaces that secret,
 * an empty string or undefined keeps the stored one (the browser never sees
 * stored secrets, so a blank field means "unchanged"), null removes it.
 */
export async function saveIntegration(opts: {
  tenantId: string;
  kind: IntegrationKind;
  config: Record<string, unknown>;
  secretsPatch: Record<string, string | null | undefined>;
  userId: string;
}): Promise<void> {
  const existing = await getIntegration(opts.kind, opts.tenantId);
  const secrets: Record<string, string> = { ...(existing?.secrets ?? {}) };
  for (const [k, v] of Object.entries(opts.secretsPatch)) {
    if (v === null) delete secrets[k];
    else if (typeof v === 'string' && v.trim() !== '') secrets[k] = v.trim();
  }
  const values = {
    config: opts.config,
    secretsEnc: Object.keys(secrets).length ? encryptSecrets(secrets) : null,
    updatedBy: opts.userId,
    updatedAt: new Date(),
  };
  await db
    .insert(integrationSettings)
    .values({ tenantId: opts.tenantId, kind: opts.kind, ...values })
    .onConflictDoUpdate({ target: [integrationSettings.tenantId, integrationSettings.kind], set: values });
  clearIntegrationCache();
}

export async function deleteIntegration(tenantId: string, kind: IntegrationKind): Promise<void> {
  await db
    .delete(integrationSettings)
    .where(and(eq(integrationSettings.tenantId, tenantId), eq(integrationSettings.kind, kind)));
  clearIntegrationCache();
}
