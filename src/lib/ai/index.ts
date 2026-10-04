import { z } from 'zod';
import { chat, extractJson, transcribe as transcribeAudio, type ImageInput } from './adapters';
import { notConnected, resolveAiTarget } from './config';

export interface AIProvider {
  chatJSON<T>(opts: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
    model?: 'heavy' | 'light';
  }): Promise<T>;
  // Multi-turn plain-text chat — no JSON parsing. Ideal for conversational AI.
  chatText(opts: {
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    model?: 'heavy' | 'light';
  }): Promise<string>;
  transcribe(audioUrl: string): Promise<string>;
  transcribeBlob(audioBuffer: ArrayBuffer, filename?: string): Promise<string>;
  describeImage(imageUrl: string, prompt: string): Promise<string>;
}

/** 'heavy' work runs on the "Text & briefs" choice, 'light' on "Quick replies". */
const taskFor = (model: 'heavy' | 'light' = 'light') => (model === 'heavy' ? 'text' : 'fast');

async function target(task: 'text' | 'fast' | 'vision' | 'voice') {
  const t = await resolveAiTarget(task);
  if (!t) throw notConnected(task);
  return t;
}

async function fetchImage(imageUrl: string): Promise<ImageInput> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not download the image (${res.status}).`);
  const blob = await res.blob();
  return { base64: Buffer.from(await blob.arrayBuffer()).toString('base64'), mimeType: blob.type || 'image/jpeg' };
}

/**
 * The single AI entry point. Which provider and model serve each kind of work
 * is chosen by the owner in Settings → Integrations → AI (falling back to the
 * GROQ_API_KEY / GOOGLE_AI_API_KEY environment variables).
 */
export const ai: AIProvider = {
  async chatText({ system, messages, model }) {
    return chat(await target(taskFor(model)), system, messages);
  },

  async chatJSON({ system, user, schema, model }) {
    const reply = await chat(
      await target(taskFor(model)),
      `${system}\n\nRespond with valid JSON only.`,
      [{ role: 'user', content: user }],
      { json: true },
    );
    return schema.parse(extractJson(reply));
  },

  async transcribe(audioUrl: string) {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error(`Could not download the voice note (${res.status}).`);
    return transcribeAudio(await target('voice'), await res.blob(), 'audio.ogg');
  },

  async transcribeBlob(audioBuffer: ArrayBuffer, filename = 'voice-note.webm') {
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'webm';
    const blob = new Blob([audioBuffer], { type: ext === 'ogg' ? 'audio/ogg' : 'audio/webm' });
    return transcribeAudio(await target('voice'), blob, filename);
  },

  async describeImage(imageUrl: string, prompt: string) {
    const image = await fetchImage(imageUrl);
    return chat(await target('vision'), 'You describe interior design site photos accurately and concisely.',
      [{ role: 'user', content: prompt }], { image });
  },
};
