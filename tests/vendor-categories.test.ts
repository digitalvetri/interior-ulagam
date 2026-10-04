import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  VendorCategoryNameSchema, normalizeCategoryName, categoryBadge, DEFAULT_VENDOR_CATEGORIES, VENDOR_CATEGORY_MAX,
} from '@/lib/vendor-categories';

describe('vendor category names', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeCategoryName('  Glass   &  Mirror ')).toBe('Glass & Mirror');
    expect(VendorCategoryNameSchema.parse('  Paint ')).toBe('Paint');
  });

  it('rejects blank names', () => {
    expect(VendorCategoryNameSchema.safeParse('').success).toBe(false);
    expect(VendorCategoryNameSchema.safeParse('    ').success).toBe(false);
    expect(VendorCategoryNameSchema.safeParse(undefined).success).toBe(false);
    expect(VendorCategoryNameSchema.safeParse(42).success).toBe(false);
  });

  it(`allows up to ${VENDOR_CATEGORY_MAX} characters`, () => {
    expect(VendorCategoryNameSchema.safeParse('a'.repeat(VENDOR_CATEGORY_MAX)).success).toBe(true);
    const tooLong = VendorCategoryNameSchema.safeParse('a'.repeat(VENDOR_CATEGORY_MAX + 1));
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]?.message).toMatch(/60 characters/);
  });

  it('seeds the old fixed list', () => {
    expect(DEFAULT_VENDOR_CATEGORIES).toEqual([
      'Laminate', 'Hardware', 'Furniture', 'Fabric', 'Lighting', 'Flooring', 'Sanitary', 'Other',
    ]);
  });

  it('keeps badge colours stable and case-insensitive', () => {
    expect(categoryBadge('Laminate')).toEqual({ bg: '#F3E8FF', color: '#7E22CE' });
    expect(categoryBadge('Glass')).toEqual(categoryBadge('glass '));
  });
});

describe('vendor category routes', () => {
  const API = join(__dirname, '..', 'src', 'app', 'api', 'v1', 'vendor-categories');

  it('rename and delete are owner-only; list and add are procurement roles', () => {
    const list = readFileSync(join(API, 'route.ts'), 'utf8');
    const item = readFileSync(join(API, '[id]', 'route.ts'), 'utf8');
    expect(list.match(/requireApiRole\(ctx, ROLES\.PROCUREMENT\)/g)).toHaveLength(2);
    expect(item.match(/requireApiRole\(ctx, ROLES\.OWNER_ONLY\)/g)).toHaveLength(2);
  });

  it('rename rewrites vendors in the same transaction', () => {
    const item = readFileSync(join(API, '[id]', 'route.ts'), 'utf8');
    const patch = item.slice(item.indexOf('export async function PATCH'), item.indexOf('export async function DELETE'));
    const tx = patch.slice(patch.indexOf('db.transaction'));
    expect(tx).toContain('.update(vendorCategories)');
    expect(tx).toContain('.update(vendors)');
  });
});
