import type { StudioBranding } from './DocumentLayout';

/**
 * Extract StudioBranding from a tenant DB row.
 * Safe to call with any tenant row — unknown brandingJson fields are ignored.
 */
export function extractBranding(tenant: {
  name: string;
  gstin?: string | null;
  brandingJson?: unknown;
}): StudioBranding {
  const b = (tenant.brandingJson ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    name: tenant.name,
    gstin: tenant.gstin ?? null,
    address: str(b.address),
    phone: str(b.phone),
    email: str(b.email),
    logoUrl: str(b.logoUrl),
    bankName: str(b.bankName),
    bankAccount: str(b.bankAccount),
    bankIFSC: str(b.bankIFSC),
    bankUPI: str(b.bankUPI),
  };
}

/** Extract terms string for a given doc type from brandingJson. */
export function extractTerms(
  brandingJson: unknown,
  docType: 'quotation' | 'invoice' | 'po',
): string | null {
  const b = (brandingJson ?? {}) as Record<string, unknown>;
  const key =
    docType === 'quotation'
      ? 'quotationTerms'
      : docType === 'invoice'
        ? 'invoiceTerms'
        : 'poTerms';
  const v = b[key];
  return typeof v === 'string' && v ? v : null;
}

/** Extract quote validity days (default 30) from brandingJson. */
export function extractValidityDays(brandingJson: unknown): number {
  const b = (brandingJson ?? {}) as Record<string, unknown>;
  const v = b.quoteValidityDays;
  return typeof v === 'number' && v > 0 ? v : 30;
}
