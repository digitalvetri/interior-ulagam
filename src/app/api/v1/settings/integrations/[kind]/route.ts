import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, requireApiRole, ROLES } from '@/lib/auth';
import { INPUTS, integrationStatus, toStored } from '@/lib/integrations/service';
import { deleteIntegration, saveIntegration, INTEGRATION_KINDS, type IntegrationKind } from '@/lib/integrations/store';

type Params = { params: Promise<{ kind: string }> };

function kindOf(raw: string): IntegrationKind | null {
  return (INTEGRATION_KINDS as string[]).includes(raw) ? (raw as IntegrationKind) : null;
}

// PUT /api/v1/settings/integrations/[kind] — save a connection (owner only).
export async function PUT(request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const kind = kindOf((await params).kind);
  if (!kind) return NextResponse.json({ error: 'Unknown integration' }, { status: 404 });

  const parsed = INPUTS[kind].safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings' }, { status: 422 });
  }

  try {
    const { config, secretsPatch } = toStored(kind, parsed.data);
    await saveIntegration({ tenantId: ctx.tenantId, kind, config, secretsPatch, userId: ctx.userId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save' }, { status: 422 });
  }
  return NextResponse.json({ data: await integrationStatus() });
}

// DELETE /api/v1/settings/integrations/[kind] — disconnect (owner only).
// Falls back to any server environment configuration.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const denied = requireApiRole(ctx, ROLES.OWNER_ONLY);
  if (denied) return denied;

  const kind = kindOf((await params).kind);
  if (!kind) return NextResponse.json({ error: 'Unknown integration' }, { status: 404 });

  await deleteIntegration(ctx.tenantId, kind);
  return NextResponse.json({ data: await integrationStatus() });
}
