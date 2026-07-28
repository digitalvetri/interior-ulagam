import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { backfillLeadsToCustomers } from '@/lib/customers/sync';

// POST /api/v1/customers/backfill
// Owner-only. Processes all existing leads without a customerId and upserts
// a customer record for each one. Safe to run multiple times (idempotent).

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden — owner only' }, { status: 403 });
  }

  try {
    const result = await backfillLeadsToCustomers(ctx.tenantId);
    return NextResponse.json({ data: result, message: 'Backfill complete' });
  } catch (e) {
    console.error('[POST /api/v1/customers/backfill]', e);
    return NextResponse.json({ error: 'Backfill failed' }, { status: 500 });
  }
}
