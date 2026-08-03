import Groq from 'groq-sdk';
import type { AIProvider } from './index';

// Lazily constructed: the SDK throws on a missing key at construction time, and
// Next evaluates route modules while collecting page data during `next build` —
// so building would require a live API key. Deferring to first call keeps the
// build secret-free and surfaces a clear error at request time instead.
let _groq: Groq | null = null;

function getGroq(): Groq {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set — AI features are unavailable.');
  }
  _groq ??= new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _groq;
}

const MODELS = {
  heavy: 'meta-llama/llama-4-maverick-17b-128e-instruct',
  light: 'meta-llama/llama-4-scout-17b-16e-instruct',
};

export const groqProvider: AIProvider = {
  async chatJSON({ system, user, schema, model = 'light' }) {
    const completion = await getGroq().chat.completions.create({
      model: MODELS[model],
      messages: [
        { role: 'system', content: system + '\n\nRespond with valid JSON only.' },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    });
    const text = completion.choices[0]?.message?.content ?? '{}';
    return schema.parse(JSON.parse(text));
  },

  async transcribe(audioUrl: string) {
    // Download audio then transcribe
    const response = await fetch(audioUrl);
    const blob = await response.blob();
    const file = new File([blob], 'audio.ogg', { type: 'audio/ogg' });
    const result = await getGroq().audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      language: 'ta', // Tanglish — Tamil with English code-switching
    });
    return result.text;
  },

  async transcribeBlob(audioBuffer: ArrayBuffer, filename = 'voice-note.webm') {
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'webm';
    const type = ext === 'ogg' ? 'audio/ogg' : 'audio/webm';
    const file = new File([audioBuffer], filename, { type });
    const result = await getGroq().audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
      language: 'ta', // Tanglish — Tamil with English code-switching
    });
    return result.text;
  },

  async describeImage() {
    throw new Error('Use geminiProvider for image description');
  },
};
