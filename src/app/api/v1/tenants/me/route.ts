import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenants } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

/**
 * GET /api/v1/tenants/me
 * Returns the full branding profile for the current tenant.
 * Used by PDF generators and the client portal to get studio info.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [row] = await db
    .select({ id: tenants.id, name: tenants.name, gstin: tenants.gstin, brandingJson: tenants.brandingJson })
    .from(tenants)
    .where(eq(tenants.id, ctx.tenantId))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const b = (row.brandingJson ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);

  return NextResponse.json({
    data: {
      id:                  row.id,
      name:                row.name,
      gstin:               row.gstin,
      tagline:             str(b.tagline),
      phone:               str(b.phone),
      email:               str(b.email),
      address:             str(b.address),
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
    },
  });
}
