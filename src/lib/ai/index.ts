import { z } from 'zod';

export interface AIProvider {
  chatJSON<T>(opts: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
    model?: 'heavy' | 'light';
  }): Promise<T>;
  transcribe(audioUrl: string): Promise<string>;
  transcribeBlob(audioBuffer: ArrayBuffer, filename?: string): Promise<string>;
  describeImage(imageUrl: string, prompt: string): Promise<string>;
}

export { groqProvider } from './groq';
export { geminiProvider } from './gemini';
