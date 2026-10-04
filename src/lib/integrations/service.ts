import { deflateSync } from 'zlib';
import { z } from 'zod';
import { AI_PROVIDERS, AI_TASKS, providerInfo, type AiTask } from '@/lib/ai/catalog';
import { buildTarget, type AiConfig } from '@/lib/ai/config';
import { chat, transcribe } from '@/lib/ai/adapters';
import { maskSecret } from './crypto';
import { getIntegration, type IntegrationKind } from './store';
import { getRazorpayConfig, getWhatsAppConfig } from './resolve';

// ─── Input schemas (shared by save and test) ─────────────────────────────────

const taskChoice = z.object({ provider: z.string().min(1), model: z.string().trim().min(1).max(200) });
const providerIds = AI_PROVIDERS.map((p) => p.id) as [string, ...string[]];

export const AiInput = z.object({
  tasks: z.object({
    text: taskChoice.optional(), fast: taskChoice.optional(),
    vision: taskChoice.optional(), voice: taskChoice.optional(),
  }),
  customBaseUrl: z.string().trim().url().optional().or(z.literal('')),
  /** New keys per provider; blank = keep the saved key, null = remove it. */
  keys: z.record(z.enum(providerIds), z.string().max(500).nullable()).default({}),
});

export const WhatsAppInput = z.object({
  phoneNumberId: z.string().trim().min(1, 'Phone Number ID is required').max(64),
  businessAccountId: z.string().trim().max(64).optional().or(z.literal('')),
  verifyToken: z.string().trim().min(8, 'Verify token must be at least 8 characters').max(200),
  accessToken: z.string().max(2000).optional(),
  appSecret: z.string().max(500).optional(),
});

export const RazorpayInput = z.object({
  keyId: z.string().trim().regex(/^rzp_(test|live)_/, 'Key ID starts with rzp_test_ or rzp_live_'),
  keySecret: z.string().max(500).optional(),
  webhookSecret: z.string().max(500).optional(),
});

export const INPUTS = { ai: AiInput, whatsapp: WhatsAppInput, razorpay: RazorpayInput } as const;

/** Split validated input into stored config (non-secret) and a secrets patch. */
export function toStored(kind: IntegrationKind, input: unknown): {
  config: Record<string, unknown>;
  secretsPatch: Record<string, string | null | undefined>;
} {
  if (kind === 'ai') {
    const v = input as z.infer<typeof AiInput>;
    for (const [task, choice] of Object.entries(v.tasks)) {
      const info = choice && providerInfo(choice.provider);
      if (!choice) continue;
      if (!info) throw new Error(`Unknown AI provider "${choice.provider}".`);
      if (task === 'voice' && !info.supports.voice) throw new Error(`${info.label} cannot transcribe voice notes.`);
      if (task === 'vision' && !info.supports.vision) throw new Error(`${info.label} cannot read photos.`);
    }
    const cfg: AiConfig = { tasks: v.tasks, customBaseUrl: v.customBaseUrl || undefined };
    return { config: cfg as Record<string, unknown>, secretsPatch: v.keys };
  }
  if (kind === 'whatsapp') {
    const v = input as z.infer<typeof WhatsAppInput>;
    return {
      config: { phoneNumberId: v.phoneNumberId, businessAccountId: v.businessAccountId || null },
      secretsPatch: { accessToken: v.accessToken, appSecret: v.appSecret, verifyToken: v.verifyToken },
    };
  }
  const v = input as z.infer<typeof RazorpayInput>;
  return { config: { keyId: v.keyId }, secretsPatch: { keySecret: v.keySecret, webhookSecret: v.webhookSecret } };
}

// ─── Status for the settings screen (never returns a secret) ─────────────────

export async function integrationStatus() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
  const [aiSaved, wa, rz] = await Promise.all([getIntegration('ai'), getWhatsAppConfig(), getRazorpayConfig()]);

  const aiCfg = (aiSaved?.config ?? {}) as AiConfig;
  const aiEnv = !aiSaved && (process.env.GROQ_API_KEY || process.env.GOOGLE_AI_API_KEY);
  const keys: Record<string, string | null> = {};
  for (const p of AI_PROVIDERS) keys[p.id] = maskSecret(aiSaved?.secrets[p.id]);

  return {
    appUrl,
    ai: {
      source: aiSaved ? 'app' : aiEnv ? 'env' : 'none',
      tasks: aiCfg.tasks ?? {},
      customBaseUrl: aiCfg.customBaseUrl ?? '',
      keys,
    },
    whatsapp: {
      source: wa.source,
      phoneNumberId: wa.phoneNumberId ?? '',
      businessAccountId: wa.businessAccountId ?? '',
      // The verify token is typed into Meta's webhook form, so the owner needs to see it.
      verifyToken: wa.verifyToken ?? '',
      accessToken: maskSecret(wa.accessToken ?? undefined),
      appSecret: maskSecret(wa.appSecret ?? undefined),
      webhookUrl: `${appUrl}/api/webhooks/whatsapp`,
    },
    razorpay: {
      source: rz.source,
      keyId: rz.keyId ?? '',
      keySecret: maskSecret(rz.keySecret ?? undefined),
      webhookSecret: maskSecret(rz.webhookSecret ?? undefined),
      webhookUrl: `${appUrl}/api/webhooks/razorpay`,
    },
  };
}

// ─── Live connection tests ───────────────────────────────────────────────────

export interface TestResult { name: string; ok: boolean; detail: string; ms: number }

async function timed(name: string, fn: () => Promise<string>): Promise<TestResult> {
  const t = Date.now();
  try {
    return { name, ok: true, detail: await fn(), ms: Date.now() - t };
  } catch (e) {
    return { name, ok: false, detail: e instanceof Error ? e.message : 'Failed', ms: Date.now() - t };
  }
}

/** Merge unsaved form values with the stored secrets (blank field = stored value). */
async function effectiveSecrets(kind: IntegrationKind, patch: Record<string, string | null | undefined>) {
  const saved = await getIntegration(kind);
  const merged: Record<string, string> = { ...(saved?.secrets ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete merged[k];
    else if (typeof v === 'string' && v.trim()) merged[k] = v.trim();
  }
  return merged;
}

export async function testAi(input: z.infer<typeof AiInput>): Promise<TestResult[]> {
  const secrets = await effectiveSecrets('ai', input.keys);
  const results: TestResult[] = [];
  for (const { key, label } of AI_TASKS) {
    const choice = input.tasks[key as AiTask];
    if (!choice) continue;
    const target = buildTarget(choice, secrets, input.customBaseUrl || undefined, 'app');
    const name = `${label} — ${providerInfo(choice.provider)?.label ?? choice.provider} · ${choice.model}`;
    if (!target) { results.push({ name, ok: false, detail: 'No API key saved for this provider.', ms: 0 }); continue; }
    results.push(await timed(name, async () => {
      if (key === 'voice') {
        await transcribe(target, new Blob([new Uint8Array(silentWav())], { type: 'audio/wav' }), 'test.wav');
        return 'Voice transcription responded.';
      }
      const reply = await chat(target, 'You are a connection test.', [
        { role: 'user', content: key === 'vision' ? 'What colour is this image? Answer in one word.' : 'Reply with the single word OK.' },
      ], { maxTokens: 20, ...(key === 'vision' ? { image: { base64: solidPng().toString('base64'), mimeType: 'image/png' } } : {}) });
      return `Replied: "${reply.trim().slice(0, 60)}"`;
    }));
  }
  if (results.length === 0) results.push({ name: 'AI', ok: false, detail: 'Choose a provider and model for at least one task.', ms: 0 });
  return results;
}

export async function testWhatsApp(input: z.infer<typeof WhatsAppInput>): Promise<TestResult[]> {
  const s = await effectiveSecrets('whatsapp', { accessToken: input.accessToken });
  return [await timed('WhatsApp Cloud API', async () => {
    if (!s.accessToken) throw new Error('Enter the access token.');
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(input.phoneNumberId)}?fields=display_phone_number,verified_name`,
      { headers: { authorization: `Bearer ${s.accessToken}` }, signal: AbortSignal.timeout(20_000) },
    );
    const j = await res.json().catch(() => ({})) as { display_phone_number?: string; verified_name?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(`Meta returned ${res.status}: ${j.error?.message ?? 'check the Phone Number ID and token'}`);
    return `Connected to ${j.verified_name ?? 'WhatsApp'} (${j.display_phone_number ?? input.phoneNumberId}).`;
  })];
}

export async function testRazorpay(input: z.infer<typeof RazorpayInput>): Promise<TestResult[]> {
  const s = await effectiveSecrets('razorpay', { keySecret: input.keySecret });
  return [await timed('Razorpay', async () => {
    if (!s.keySecret) throw new Error('Enter the key secret.');
    const res = await fetch('https://api.razorpay.com/v1/payments?count=1', {
      headers: { authorization: `Basic ${Buffer.from(`${input.keyId}:${s.keySecret}`).toString('base64')}` },
      signal: AbortSignal.timeout(20_000),
    });
    const j = await res.json().catch(() => ({})) as { error?: { description?: string } };
    if (!res.ok) throw new Error(`Razorpay returned ${res.status}: ${j.error?.description ?? 'check the key ID and secret'}`);
    return `Connected (${input.keyId.startsWith('rzp_live_') ? 'live' : 'test'} mode).`;
  })];
}

// ─── Tiny test media (no files needed) ───────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** A 64×64 solid red PNG for the photo test. */
export function solidPng(size = 64): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, Buffer.from([220, 30, 30]))]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
/** Half a second of 16 kHz mono silence for the voice test. */
export function silentWav(seconds = 0.5): Buffer {
  const rate = 16_000;
  const data = Buffer.alloc(Math.round(rate * seconds) * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
