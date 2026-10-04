import { z } from 'zod';

// Pure helpers shared by the vendor-category API and the Vendors screens.
// No db/auth imports — client components and unit tests import this file.

export const VENDOR_CATEGORY_MAX = 60;

/** Seeded for every studio (migration 0033 and first-run setup). */
export const DEFAULT_VENDOR_CATEGORIES = [
  'Laminate', 'Hardware', 'Furniture', 'Fabric', 'Lighting', 'Flooring', 'Sanitary', 'Other',
] as const;

/** Trims and collapses inner whitespace so "  Glass   & Mirror " is stored once. */
export function normalizeCategoryName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export const VendorCategoryNameSchema = z
  .string({ required_error: 'Category name is required', invalid_type_error: 'Category name must be text' })
  .transform(normalizeCategoryName)
  .pipe(
    z.string()
      .min(1, 'Category name is required')
      .max(VENDOR_CATEGORY_MAX, `Category name must be ${VENDOR_CATEGORY_MAX} characters or fewer`),
  );

export interface VendorCategory {
  id: string;
  name: string;
  sortOrder: number;
  vendorCount: number;
}

const KNOWN_BADGES: Record<string, { bg: string; color: string }> = {
  laminate:  { bg: '#F3E8FF', color: '#7E22CE' },
  hardware:  { bg: '#DBEAFE', color: '#1D4ED8' },
  furniture: { bg: '#FEF3C7', color: '#92400E' },
  fabric:    { bg: '#FCE7F3', color: '#9D174D' },
  lighting:  { bg: '#FEFCE8', color: '#713F12' },
  flooring:  { bg: '#D1FAE5', color: '#065F46' },
  sanitary:  { bg: '#CCFBF1', color: '#0F766E' },
  other:     { bg: 'var(--surface-muted)', color: 'var(--text-secondary)' },
};

const PALETTE: { bg: string; color: string }[] = [
  { bg: '#E0E7FF', color: '#3730A3' },
  { bg: '#FFE4E6', color: '#9F1239' },
  { bg: '#ECFCCB', color: '#3F6212' },
  { bg: '#FFEDD5', color: '#9A3412' },
  { bg: '#E0F2FE', color: '#075985' },
  { bg: '#F5F5F4', color: '#44403C' },
];

/** Stable badge colours: the default categories keep theirs, others hash into a palette. */
export function categoryBadge(name: string): { bg: string; color: string } {
  const key = name.trim().toLowerCase();
  const known = KNOWN_BADGES[key];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
