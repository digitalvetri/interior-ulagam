import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { decryptSecrets, encryptSecrets, maskSecret } from '../src/lib/integrations/crypto';
import { chat, extractJson, transcribe } from '../src/lib/ai/adapters';
import { AI_PROVIDERS, providersFor } from '../src/lib/ai/catalog';
import { toStored, solidPng, silentWav } from '../src/lib/integrations/service';

describe('integration secrets', () => {
  beforeEach(() => { process.env.BETTER_AUTH_SECRET = 'test-secret-for-hkdf-0123456789'; });

  it('round-trips and never stores plaintext', () => {
    const blob = encryptSecrets({ openai: 'sk-live-abcdef123456' });
    expect(blob.startsWith('v1:')).toBe(true);
    expect(blob).not.toContain('sk-live');
    expect(decryptSecrets(blob)).toEqual({ openai: 'sk-live-abcdef123456' });
  });

  it('rejects tampered ciphertext', () => {
    const parts = encryptSecrets({ a: 'b' }).split(':');
    parts[3] = Buffer.from('tampered!').toString('base64');
    expect(() => decryptSecrets(parts.join(':'))).toThrow();
  });

  it('cannot decrypt with a different server secret', () => {
    const blob = encryptSecrets({ a: 'b' });
    process.env.BETTER_AUTH_SECRET = 'another-secret-entirely-xyz';
    expect(() => decryptSecrets(blob)).toThrow();
  });

  it('fails loudly without a server secret', () => {
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => encryptSecrets({ a: 'b' })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('masks to the last four characters', () => {
    expect(maskSecret('sk-abcdefgh1234')).toBe('••••1234');
    expect(maskSecret(undefined)).toBeNull();
  });
});

describe('toStored keeps secrets out of plain config', () => {
  it('whatsapp tokens go to secrets', () => {
    const { config, secretsPatch } = toStored('whatsapp', {
      phoneNumberId: '123', businessAccountId: '', verifyToken: 'verify-me-123', accessToken: 'EAAG-secret', appSecret: 'app-secret',
    });
    expect(JSON.stringify(config)).not.toMatch(/EAAG|app-secret/);
    expect(secretsPatch).toMatchObject({ accessToken: 'EAAG-secret', appSecret: 'app-secret' });
  });

  it('razorpay secret goes to secrets', () => {
    const { config, secretsPatch } = toStored('razorpay', { keyId: 'rzp_test_x', keySecret: 'shh', webhookSecret: 'wh' });
    expect(config).toEqual({ keyId: 'rzp_test_x' });
    expect(secretsPatch).toEqual({ keySecret: 'shh', webhookSecret: 'wh' });
  });

  it('AI keys go to secrets and capability is enforced', () => {
    const { config, secretsPatch } = toStored('ai', { tasks: { text: { provider: 'openai', model: 'gpt-4.1' } }, keys: { openai: 'sk-1' } });
    expect(JSON.stringify(config)).not.toContain('sk-1');
    expect(secretsPatch).toEqual({ openai: 'sk-1' });
    expect(() => toStored('ai', { tasks: { voice: { provider: 'anthropic', model: 'x' } }, keys: {} })).toThrow(/voice/);
    expect(() => toStored('ai', { tasks: { vision: { provider: 'deepseek', model: 'x' } }, keys: {} })).toThrow(/photos/);
  });
});

describe('AI adapters', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it('OpenAI-compatible: URL, bearer key, JSON mode only when supported', async () => {
    fetchMock.mockImplementation(async () => ok({ choices: [{ message: { content: '{"a":1}' } }] }));
    await chat({ protocol: 'openai', baseUrl: 'https://api.groq.com/openai/v1/', apiKey: 'gk', model: 'm', label: 'Groq', jsonMode: true },
      'sys', [{ role: 'user', content: 'hi' }], { json: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer gk');
    const body = JSON.parse(init.body);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });

    await chat({ protocol: 'openai', baseUrl: 'http://x/v1', apiKey: '', model: 'm', label: 'Custom', jsonMode: false },
      'sys', [{ role: 'user', content: 'hi' }], { json: true });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).response_format).toBeUndefined();
  });

  it('OpenAI-compatible: images go as a data URL', async () => {
    fetchMock.mockResolvedValue(ok({ choices: [{ message: { content: 'red' } }] }));
    await chat({ protocol: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'k', model: 'm', label: 'OpenAI' },
      'sys', [{ role: 'user', content: 'what?' }], { image: { base64: 'AAAA', mimeType: 'image/png' } });
    const content = JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content;
    expect(content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } });
  });

  it('Anthropic: native headers, system field, base64 image block', async () => {
    fetchMock.mockResolvedValue(ok({ content: [{ type: 'text', text: 'hello' }] }));
    const reply = await chat({ protocol: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: 'ak', model: 'claude-x', label: 'Claude' },
      'sys', [{ role: 'user', content: 'what?' }], { image: { base64: 'BBBB', mimeType: 'image/jpeg' } });
    expect(reply).toBe('hello');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('ak');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(init.body);
    expect(body.system).toBe('sys');
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'BBBB' } });
  });

  it('surfaces the provider error message', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 }));
    await expect(chat({ protocol: 'openai', baseUrl: 'https://x/v1', apiKey: 'bad', model: 'm', label: 'OpenAI' }, 's', [{ role: 'user', content: 'h' }]))
      .rejects.toThrow('OpenAI returned 401: Invalid API key');
  });

  it('transcription posts multipart with Tamil language', async () => {
    fetchMock.mockResolvedValue(ok({ text: 'vanakkam' }));
    const text = await transcribe({ baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'gk', model: 'whisper-large-v3-turbo', label: 'Groq' },
      new Blob([new Uint8Array(silentWav())]), 'a.wav');
    expect(text).toBe('vanakkam');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect((init.body as FormData).get('language')).toBe('ta');
    expect((init.body as FormData).get('model')).toBe('whisper-large-v3-turbo');
  });
});

describe('extractJson', () => {
  it('handles plain, fenced and chatty replies', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Sure! Here it is: {"a":3} Hope that helps.')).toEqual({ a: 3 });
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('catalog and test media', () => {
  it('voice and photo tasks only offer capable providers', () => {
    expect(providersFor('voice').map((p) => p.id)).toEqual(expect.arrayContaining(['openai', 'groq']));
    expect(providersFor('voice').some((p) => p.id === 'anthropic')).toBe(false);
    expect(providersFor('vision').some((p) => p.id === 'deepseek')).toBe(false);
    expect(new Set(AI_PROVIDERS.map((p) => p.id)).size).toBe(AI_PROVIDERS.length);
  });

  it('builds a valid PNG and WAV', () => {
    expect(solidPng().subarray(1, 4).toString()).toBe('PNG');
    const wav = silentWav();
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.subarray(8, 12).toString()).toBe('WAVE');
  });
});
