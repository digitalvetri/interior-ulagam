import { getIntegration } from '@/lib/integrations/store';
import type { ConfigSource } from '@/lib/integrations/resolve';
import { providerInfo, type AiTask } from './catalog';
import type { ChatTarget } from './adapters';

/** Saved AI connection (kind 'ai'): which provider/model runs each task. */
export interface AiConfig {
  tasks?: Partial<Record<AiTask, { provider: string; model: string }>>;
  customBaseUrl?: string;
}

export interface ResolvedTarget extends ChatTarget {
  providerId: string;
  source: ConfigSource;
}

/** Fallback when nothing is saved in the app: the original env-based setup. */
function envTarget(task: AiTask): ResolvedTarget | null {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  const groq = providerInfo('groq')!;
  const gemini = providerInfo('gemini')!;
  const fromGroq = (model: string): ResolvedTarget => ({
    providerId: 'groq', protocol: 'openai', baseUrl: groq.baseUrl, apiKey: groqKey!, model,
    label: groq.label, jsonMode: true, source: 'env',
  });
  const fromGemini = (model: string): ResolvedTarget => ({
    providerId: 'gemini', protocol: 'openai', baseUrl: gemini.baseUrl, apiKey: geminiKey!, model,
    label: gemini.label, jsonMode: true, source: 'env',
  });
  if (task === 'voice') return groqKey ? fromGroq('whisper-large-v3-turbo') : null;
  if (task === 'vision') return geminiKey ? fromGemini('gemini-2.5-flash') : null;
  if (groqKey) return fromGroq('qwen/qwen3.8-27b');
  if (geminiKey) return fromGemini('gemini-2.5-flash');
  return null;
}

export function buildTarget(
  choice: { provider: string; model: string },
  secrets: Record<string, string>,
  customBaseUrl: string | undefined,
  source: ConfigSource,
): ResolvedTarget | null {
  const info = providerInfo(choice.provider);
  const apiKey = secrets[choice.provider];
  const baseUrl = info?.id === 'custom' ? customBaseUrl : info?.baseUrl;
  if (!info || !choice.model || !baseUrl) return null;
  // A self-hosted custom server may not need a key.
  if (!apiKey && info.id !== 'custom') return null;
  return {
    providerId: info.id, protocol: info.protocol, baseUrl, apiKey: apiKey ?? '', model: choice.model,
    label: info.label, jsonMode: info.supports.jsonMode, source,
  };
}

/**
 * Provider + model + key for a task. Unset tasks borrow sensibly: "Quick
 * replies" uses the "Text" choice, and "Site photos" uses it too when that
 * provider reads images.
 */
export async function resolveAiTarget(task: AiTask): Promise<ResolvedTarget | null> {
  const saved = await getIntegration('ai');
  if (!saved) return envTarget(task);
  const cfg = saved.config as AiConfig;
  const tasks = cfg.tasks ?? {};
  let choice = tasks[task];
  if (!choice && task === 'fast') choice = tasks.text;
  if (!choice && task === 'vision' && tasks.text && providerInfo(tasks.text.provider)?.supports.vision) choice = tasks.text;
  if (!choice) return null;
  return buildTarget(choice, saved.secrets, cfg.customBaseUrl, 'app');
}

export function notConnected(task: AiTask): Error {
  const what = { text: 'Text', fast: 'Quick replies', vision: 'Site photos', voice: 'Voice notes' }[task];
  return new Error(`AI is not connected for "${what}" — the owner can set it up in Settings → Integrations → AI.`);
}
