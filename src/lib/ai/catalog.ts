/**
 * AI providers the owner can connect in Settings → Integrations.
 *
 * Client-safe (no server imports): the settings screen renders from this list.
 * Model names are suggestions only — providers rename models often, so the
 * screen always accepts a typed model id, and "Test" calls the real model.
 */

export type AiTask = 'text' | 'fast' | 'vision' | 'voice';

export const AI_TASKS: { key: AiTask; label: string; hint: string }[] = [
  { key: 'text',   label: 'Text & briefs',  hint: 'Lead briefs, quote drafts, the AI assistant, Monday brief' },
  { key: 'fast',   label: 'Quick replies',  hint: 'Message parsing, language detection, client chatbot — cheap and fast' },
  { key: 'vision', label: 'Site photos',    hint: 'Reads site photos for snags and BOQ drafts — needs an image-capable model' },
  { key: 'voice',  label: 'Voice notes',    hint: 'Transcribes Tamil / Tanglish voice notes — Whisper-style speech-to-text' },
];

export type AiProviderId =
  | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'deepseek' | 'mistral'
  | 'xai' | 'openrouter' | 'together' | 'custom';

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  /** 'openai' = OpenAI-compatible Chat Completions; 'anthropic' = Messages API. */
  protocol: 'openai' | 'anthropic';
  baseUrl: string;            // empty for 'custom' (owner enters it)
  keyUrl: string;             // where to create an API key
  blurb: string;
  supports: { vision: boolean; voice: boolean; jsonMode: boolean };
  models: Partial<Record<AiTask, string[]>>;
}

export const AI_PROVIDERS: AiProviderInfo[] = [
  {
    id: 'openai', label: 'OpenAI (ChatGPT)', protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys',
    blurb: 'GPT models — strong all-rounder, images and voice.',
    supports: { vision: true, voice: true, jsonMode: true },
    models: {
      text: ['gpt-4.1', 'gpt-4o', 'gpt-4.1-mini'],
      fast: ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1-nano'],
      vision: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
      voice: ['whisper-1', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe'],
    },
  },
  {
    id: 'anthropic', label: 'Anthropic Claude', protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1', keyUrl: 'https://console.anthropic.com/settings/keys',
    blurb: 'Claude models — careful writing and reasoning, reads images.',
    supports: { vision: true, voice: false, jsonMode: false },
    models: {
      text: ['claude-sonnet-5-5', 'claude-opus-5-5'],
      fast: ['claude-haiku-4-5-20251001'],
      vision: ['claude-sonnet-5-5', 'claude-haiku-4-5-20251001'],
    },
  },
  {
    id: 'gemini', label: 'Google Gemini', protocol: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey',
    blurb: 'Gemini models — generous free tier, very good with photos.',
    supports: { vision: true, voice: false, jsonMode: true },
    models: {
      text: ['gemini-2.5-pro', 'gemini-2.5-flash'],
      fast: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
      vision: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    },
  },
  {
    id: 'groq', label: 'Groq', protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys',
    blurb: 'Very fast open models and Whisper voice transcription. Free tier.',
    supports: { vision: true, voice: true, jsonMode: true },
    models: {
      text: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'qwen/qwen3.8-27b'],
      fast: ['openai/gpt-oss-20b', 'llama-3.1-8b-instant'],
      vision: ['meta-llama/llama-4-scout-17b-16e-instruct'],
      voice: ['whisper-large-v3-turbo', 'whisper-large-v3'],
    },
  },
  {
    id: 'deepseek', label: 'DeepSeek', protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys',
    blurb: 'Low-cost text models.',
    supports: { vision: false, voice: false, jsonMode: true },
    models: { text: ['deepseek-chat', 'deepseek-reasoner'], fast: ['deepseek-chat'] },
  },
  {
    id: 'mistral', label: 'Mistral AI', protocol: 'openai',
    baseUrl: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys',
    blurb: 'European models, text and images.',
    supports: { vision: true, voice: false, jsonMode: true },
    models: {
      text: ['mistral-large-latest', 'mistral-medium-latest'],
      fast: ['mistral-small-latest'],
      vision: ['mistral-medium-latest', 'pixtral-large-latest'],
    },
  },
  {
    id: 'xai', label: 'xAI Grok', protocol: 'openai',
    baseUrl: 'https://api.x.ai/v1', keyUrl: 'https://console.x.ai',
    blurb: 'Grok models.',
    supports: { vision: true, voice: false, jsonMode: true },
    models: { text: ['grok-4', 'grok-3'], fast: ['grok-3-mini'], vision: ['grok-4'] },
  },
  {
    id: 'openrouter', label: 'OpenRouter (300+ models)', protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys',
    blurb: 'One key for models from OpenAI, Anthropic, Google, Meta, Qwen and more.',
    supports: { vision: true, voice: false, jsonMode: true },
    models: {
      text: ['openai/gpt-4.1', 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-pro'],
      fast: ['openai/gpt-4.1-mini', 'google/gemini-2.5-flash'],
      vision: ['google/gemini-2.5-flash', 'openai/gpt-4.1'],
    },
  },
  {
    id: 'together', label: 'Together AI', protocol: 'openai',
    baseUrl: 'https://api.together.xyz/v1', keyUrl: 'https://api.together.ai/settings/api-keys',
    blurb: 'Open models (Llama, Qwen, DeepSeek) at low cost.',
    supports: { vision: true, voice: false, jsonMode: true },
    models: {
      text: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'],
      fast: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'],
    },
  },
  {
    id: 'custom', label: 'Custom (OpenAI-compatible)', protocol: 'openai',
    baseUrl: '', keyUrl: '',
    blurb: 'Any OpenAI-compatible server — self-hosted Ollama, vLLM, LM Studio, a company gateway.',
    supports: { vision: true, voice: true, jsonMode: false },
    models: {},
  },
];

export function providerInfo(id: string): AiProviderInfo | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

/** Which providers can serve a task at all (voice needs speech-to-text, photos need images). */
export function providersFor(task: AiTask): AiProviderInfo[] {
  if (task === 'voice') return AI_PROVIDERS.filter((p) => p.supports.voice);
  if (task === 'vision') return AI_PROVIDERS.filter((p) => p.supports.vision);
  return AI_PROVIDERS;
}
