import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider } from './index';

let cached: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (cached) return cached;
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY must be set');
  }
  cached = new GoogleGenerativeAI(apiKey);
  return cached;
}

export const geminiProvider: AIProvider = {
  async chatJSON({ system, user, schema }) {
    const model = getGenAI().getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(
      `${system}\n\nRespond with valid JSON only.\n\n${user}`
    );
    const text = result.response.text();
    return schema.parse(JSON.parse(text));
  },

  async transcribe() {
    throw new Error('Use groqProvider for transcription');
  },

  async describeImage(imageUrl: string, prompt: string) {
    const model = getGenAI().getGenerativeModel({ model: 'gemini-1.5-flash' });
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const imageBytes = await imageBlob.arrayBuffer();
    const base64Image = Buffer.from(imageBytes).toString('base64');
    const mimeType = imageBlob.type || 'image/jpeg';

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType } },
    ]);
    return result.response.text();
  },
};
