import Groq from 'groq-sdk';
import type { AIProvider } from './index';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODELS = {
  heavy: 'meta-llama/llama-4-maverick-17b-128e-instruct',
  light: 'meta-llama/llama-4-scout-17b-16e-instruct',
};

export const groqProvider: AIProvider = {
  async chatJSON({ system, user, schema, model = 'light' }) {
    const completion = await groq.chat.completions.create({
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
    const result = await groq.audio.transcriptions.create({
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
    const result = await groq.audio.transcriptions.create({
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
