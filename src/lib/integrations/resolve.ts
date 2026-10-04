import { getIntegration } from './store';

/**
 * Effective WhatsApp / Razorpay settings. A connection saved in Settings →
 * Integrations wins; otherwise the server environment variables are used, so an
 * existing env-based setup keeps working. `source` tells the UI which applies.
 */

export type ConfigSource = 'app' | 'env' | 'none';

export interface WhatsAppConfig {
  source: ConfigSource;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  accessToken: string | null;
  verifyToken: string | null;
  appSecret: string | null;
}

export async function getWhatsAppConfig(tenantId?: string | null): Promise<WhatsAppConfig> {
  const saved = await getIntegration('whatsapp', tenantId);
  if (saved) {
    const c = saved.config as { phoneNumberId?: string; businessAccountId?: string };
    return {
      source: 'app',
      phoneNumberId: c.phoneNumberId || null,
      businessAccountId: c.businessAccountId || null,
      accessToken: saved.secrets.accessToken || null,
      verifyToken: saved.secrets.verifyToken || null,
      appSecret: saved.secrets.appSecret || null,
    };
  }
  const env = process.env;
  const any = env.WHATSAPP_ACCESS_TOKEN || env.WHATSAPP_PHONE_NUMBER_ID;
  return {
    source: any ? 'env' : 'none',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || null,
    businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID || null,
    accessToken: env.WHATSAPP_ACCESS_TOKEN || null,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || null,
    appSecret: env.WHATSAPP_APP_SECRET || null,
  };
}

export interface RazorpayConfig {
  source: ConfigSource;
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
}

export async function getRazorpayConfig(tenantId?: string | null): Promise<RazorpayConfig> {
  const saved = await getIntegration('razorpay', tenantId);
  if (saved) {
    const c = saved.config as { keyId?: string };
    return {
      source: 'app',
      keyId: c.keyId || null,
      keySecret: saved.secrets.keySecret || null,
      webhookSecret: saved.secrets.webhookSecret || null,
    };
  }
  const env = process.env;
  return {
    source: env.RAZORPAY_KEY_ID ? 'env' : 'none',
    keyId: env.RAZORPAY_KEY_ID || null,
    keySecret: env.RAZORPAY_KEY_SECRET || null,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || null,
  };
}
