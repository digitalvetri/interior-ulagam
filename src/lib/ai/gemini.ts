import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider } from './index';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export const geminiProvider: AIProvider = {
  async chatJSON({ system, user, schema }) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(
      `${system}\n\nRespond with valid JSON only.\n\n${user}`
    );
    const text = result.response.text();
    return schema.parse(JSON.parse(text));
  },

  async transcribe() {
    throw new Error('Use groqProvider for transcription');
  },

  async transcribeBlob() {
    throw new Error('Use groqProvider for transcription');
  },

  async describeImage(imageUrl: string, prompt: string) {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
