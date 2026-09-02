import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

interface BrandingJson {
  studio?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  pan?: string;
  logoUrl?: string;
  bankName?: string;
  bankAccount?: string;
  bankIFSC?: string;
  bankUPI?: string;
  quotationTerms?: string;
  invoiceTerms?: string;
  poTerms?: string;
  quoteNumberPrefix?: string;
  invoiceNumberPrefix?: string;
  poNumberPrefix?: string;
  quoteValidityDays?: number;
  ownerName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerPhotoUrl?: string;
  [k: string]: unknown;
}

const PatchSchema = z.object({
  studioName:          z.string().min(1).max(200).optional(),
  tagline:             z.string().max(500).nullable().optional(),
  phone:               z.string().max(30).nullable().optional(),
  email:               z.string().email().nullable().optional().or(z.literal('')),
  website:             z.string().max(500).nullable().optional(),
  address:             z.string().max(1000).nullable().optional(),
  city:                z.string().max(100).nullable().optional(),
  state:               z.string().max(100).nullable().optional(),
  pinCode:             z.string().max(10).nullable().optional(),
  gstin:               z.string().max(20).nullable().optional(),
  pan:                 z.string().max(20).nullable().optional(),
  logoUrl:             z.string().url().nullable().optional(),
  bankName:            z.string().max(200).nullable().optional(),
  bankAccount:         z.string().max(50).nullable().optional(),
  bankIFSC:            z.string().max(20).nullable().optional(),
  bankUPI:             z.string().max(100).nullable().optional(),
  quotationTerms:      z.string().max(2000).nullable().optional(),
  invoiceTerms:        z.string().max(2000).nullable().optional(),
  poTerms:             z.string().max(2000).nullable().optional(),
  quoteNumberPrefix:   z.string().max(20).nullable().optional(),
  invoiceNumberPrefix: z.string().max(20).nullable().optional(),
  poNumberPrefix:      z.string().max(20).nullable().optional(),
  quoteValidityDays:   z.number().int().min(1).max(365).nullable().optional(),
  ownerName:           z.string().max(200).nullable().optional(),
  ownerPhone:          z.string().max(30).nullable().optional(),
  ownerEmail:          z.string().email().nullable().optional().or(z.literal('')),
  ownerPhotoUrl:       z.string().url().nullable().optional(),
});

function buildResponse(row: { name: string; gstin: string | null; brandingJson: unknown }) {
  const b = (row.brandingJson ?? {}) as BrandingJson;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    studioName:          row.name,
    gstin:               row.gstin,
    tagline:             str(b.tagline),
    phone:               str(b.phone),
    email:               str(b.email),
    website:             str(b.website),
    address:             str(b.address),
    city:                str(b.city),
    state:               str(b.state),
    pinCode:             str(b.pinCode),
    pan:                 str(b.pan),
    logoUrl:             str(b.logoUrl),
    bankName:            str(b.bankName),
    bankAccount:         str(b.bankAccount),
    bankIFSC:            str(b.bankIFSC),
    bankUPI:             str(b.bankUPI),
    quotationTerms:      str(b.quotationTerms),
    invoiceTerms:        str(b.invoiceTerms),
    poTerms:             str(b.poTerms),
    quoteNumberPrefix:   str(b.quoteNumberPrefix) ?? 'QUO-',
    invoiceNumberPrefix: str(b.invoiceNumberPrefix) ?? 'INV-',
    poNumberPrefix:      str(b.poNumberPrefix) ?? 'PO-',
    quoteValidityDays:   typeof b.quoteValidityDays === 'number' ? b.quoteValidityDays : 30,
    ownerName:           str(b.ownerName),
    ownerPhone:          str(b.ownerPhone),
    ownerEmail:          str(b.ownerEmail),
    ownerPhotoUrl:       str(b.ownerPhotoUrl),
  };
}

// GET /api/v1/settings/profile
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [row] = await db.select().from(tenants).where(eq(tenants.id, ctx.tenantId)).limit(1);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: buildResponse(row) });
}

// PATCH /api/v1/settings/profile
export async function PATCH(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() }, { status: 422 },
    );
  }

  const p = parsed.data;

  try {
    const [existing] = await db.select().from(tenants).where(eq(tenants.id, ctx.tenantId)).limit(1);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const branding: BrandingJson = { ...((existing.brandingJson ?? {}) as BrandingJson) };

    const setStr = (key: keyof BrandingJson, val: string | null | undefined) => {
      if (val === undefined) return;
      if (val === null || val === '') delete branding[key];
      else branding[key] = val as string;
    };
    const setNum = (key: keyof BrandingJson, val: number | null | undefined) => {
      if (val === undefined) return;
      if (val === null) delete branding[key];
      else branding[key] = val;
    };

    setStr('tagline',             p.tagline);
    setStr('phone',               p.phone);
    setStr('email',               p.email && p.email !== '' ? p.email : null);
    setStr('website',             p.website);
    setStr('address',             p.address);
    setStr('city',                p.city);
    setStr('state',               p.state);
    setStr('pinCode',             p.pinCode);
    setStr('pan',                 p.pan);
    setStr('logoUrl',             p.logoUrl);
    setStr('bankName',            p.bankName);
    setStr('bankAccount',         p.bankAccount);
    setStr('bankIFSC',            p.bankIFSC);
    setStr('bankUPI',             p.bankUPI);
    setStr('quotationTerms',      p.quotationTerms);
    setStr('invoiceTerms',        p.invoiceTerms);
    setStr('poTerms',             p.poTerms);
    setStr('quoteNumberPrefix',   p.quoteNumberPrefix);
    setStr('quoteNumberPrefix',   p.quoteNumberPrefix);
    setStr('invoiceNumberPrefix', p.invoiceNumberPrefix);
    setStr('poNumberPrefix',      p.poNumberPrefix);
    setNum('quoteValidityDays',   p.quoteValidityDays);
    setStr('ownerName',           p.ownerName);
    setStr('ownerPhone',          p.ownerPhone);
    setStr('ownerEmail',          p.ownerEmail && p.ownerEmail !== '' ? p.ownerEmail : null);
    setStr('ownerPhotoUrl',       p.ownerPhotoUrl);

    const patch: Record<string, unknown> = { brandingJson: branding };
    if (p.studioName !== undefined) patch.name  = p.studioName;
    if (p.gstin      !== undefined) patch.gstin = p.gstin;

    const [row] = await db.update(tenants).set(patch).where(eq(tenants.id, ctx.tenantId)).returning();
    return NextResponse.json({ data: buildResponse(row) });
  } catch (e) {
    console.error('[PATCH /api/v1/settings/profile]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
