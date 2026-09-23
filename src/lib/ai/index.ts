import { z } from 'zod';

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

export { groqProvider } from './groq';
export { geminiProvider } from './gemini';
