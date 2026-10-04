/**
 * Wire-level calls to AI providers, via fetch (no vendor SDKs):
 *  - OpenAI-compatible Chat Completions — OpenAI, Gemini, Groq, DeepSeek,
 *    Mistral, xAI, OpenRouter, Together and any custom endpoint
 *  - Anthropic Messages API
 *  - OpenAI-compatible /audio/transcriptions (Whisper-style) for voice notes
 */

export interface ChatTarget {
  protocol: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
  label: string;          // provider name, for error messages
  jsonMode?: boolean;     // send response_format json_object (OpenAI-compatible only)
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export interface ImageInput { base64: string; mimeType: string }

const TIMEOUT_MS = 90_000;

async function call(url: string, init: RequestInit, label: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new Error(`${label}: could not reach the API (${e instanceof Error ? e.message : 'network error'})`);
  }
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      msg = (typeof j.error === 'string' ? j.error : j.error?.message) ?? j.message ?? msg;
    } catch { /* not JSON — keep the raw snippet */ }
    throw new Error(`${label} returned ${res.status}: ${msg}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: unexpected non-JSON response`);
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export async function chat(
  target: ChatTarget,
  system: string,
  messages: ChatMessage[],
  opts: { image?: ImageInput; json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const maxTokens = opts.maxTokens ?? 4096;

  if (target.protocol === 'anthropic') {
    const msgs = messages.map((m, i) => {
      const isLastUser = opts.image && i === messages.length - 1 && m.role === 'user';
      return isLastUser
        ? {
            role: m.role,
            content: [
              { type: 'image', source: { type: 'base64', media_type: opts.image!.mimeType, data: opts.image!.base64 } },
              { type: 'text', text: m.content },
            ],
          }
        : m;
    });
    const data = await call(`${trimSlash(target.baseUrl)}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': target.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: target.model, max_tokens: maxTokens, system, messages: msgs }),
    }, target.label) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
  }

  const msgs: unknown[] = [{ role: 'system', content: system }];
  messages.forEach((m, i) => {
    const isLastUser = opts.image && i === messages.length - 1 && m.role === 'user';
    msgs.push(isLastUser
      ? {
          role: 'user',
          content: [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: `data:${opts.image!.mimeType};base64,${opts.image!.base64}` } },
          ],
        }
      : m);
  });
  const body: Record<string, unknown> = { model: target.model, messages: msgs, max_tokens: maxTokens };
  if (opts.json && target.jsonMode) body.response_format = { type: 'json_object' };

  const data = await call(`${trimSlash(target.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${target.apiKey}` },
    body: JSON.stringify(body),
  }, target.label) as { choices?: { message?: { content?: string | null } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

export async function transcribe(
  target: Omit<ChatTarget, 'protocol' | 'jsonMode'>,
  audio: Blob,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model', target.model);
  form.append('language', 'ta'); // Tanglish — Tamil with English code-switching
  const data = await call(`${trimSlash(target.baseUrl)}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${target.apiKey}` },
    body: form,
  }, target.label) as { text?: string };
  return data.text ?? '';
}

/**
 * Pull the JSON object out of a model reply. Not every provider has a JSON mode
 * (Anthropic doesn't), and some wrap JSON in ``` fences or add a sentence.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error('The AI reply was not valid JSON.');
  }
}
