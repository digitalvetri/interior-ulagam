// ─── Template Router: language-aware template name resolver ──────────────────
//
// Registered template variants in Meta Business Manager:
//
//   lead_followup_day3_en   — English lead follow-up at day 3
//   lead_followup_day3_ta   — Tamil lead follow-up at day 3
//   lead_followup_day3_hi   — Hindi lead follow-up at day 3
//
//   lead_followup_day7_en   — English lead follow-up at day 7
//   lead_followup_day7_ta   — Tamil lead follow-up at day 7
//   lead_followup_day7_hi   — Hindi lead follow-up at day 7
//
//   payment_receipt_en      — English payment receipt
//   payment_receipt_ta      — Tamil payment receipt
//   payment_receipt_hi      — Hindi payment receipt
//
//   site_visit_reminder_24h_en — English site visit reminder (24h)
//   site_visit_reminder_24h_ta — Tamil site visit reminder (24h)
//
//   nps_ping_en             — English NPS ping
//   nps_ping_ta             — Tamil NPS ping
//
//   payment_reminder_en     — English milestone payment reminder (params: client name, milestone label, amount)
//   payment_reminder_ta     — Tamil milestone payment reminder

export interface TemplateSendOpts {
  templateBase: string;
  language?: string;
  params: string[];
}

// Map of supported language codes to available language variant suffixes.
// Languages not listed here fall back to English.
const TEMPLATE_LANGUAGES: Record<string, string> = {
  ta: 'ta',
  hi: 'hi',
  kn: 'kn',
  en: 'en',
};

/**
 * Resolves a language-aware WhatsApp template name.
 *
 * @param base     The template base name (e.g. 'lead_followup_day3')
 * @param language The preferred language code from the lead (e.g. 'ta', 'hi')
 * @returns        The full template name with language suffix (e.g. 'lead_followup_day3_ta')
 *                 Falls back to '_en' variant when language is absent or unsupported.
 */
export function resolveTemplateName(
  base: string,
  language: string | null | undefined,
): string {
  if (language && TEMPLATE_LANGUAGES[language]) {
    return `${base}_${TEMPLATE_LANGUAGES[language]}`;
  }
  return `${base}_en`;
}
