import Groq from 'groq-sdk';
import type { AIProvider } from './index';

let cached: Groq | null = null;

function getGroq(): Groq {
  if (cached) return cached;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY must be set');
  }
  cached = new Groq({ apiKey });
  return cached;
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

  async describeImage() {
    throw new Error('Use geminiProvider for image description');
  },
};
