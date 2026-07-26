import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { requirements, leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

// The requirements table stores one aggregate row per lead.
// roomsJson holds an array of RoomEntry objects inside the jsonb column.
// budgetBandPaise is stored as an integer (paise) inside the json — never as a float.
interface RoomEntry {
  name: string;
  stylePreference?: string;
  budgetBandPaise?: number; // integer paise — NEVER float
  notes?: string;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const CreateRequirementSchema = z.object({
  leadId: z.string().uuid(),
  roomName: z.string().min(1),
  stylePreference: z.string().optional(),
  // Integer paise — validated as an integer
  budgetBandPaise: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

// ─── GET /api/v1/requirements ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const leadIdParam = searchParams.get('leadId');

  if (!leadIdParam) {
    return NextResponse.json({ error: 'Query param leadId is required' }, { status: 400 });
  }

  const leadIdParsed = z.string().uuid().safeParse(leadIdParam);
  if (!leadIdParsed.success) {
    return NextResponse.json({ error: 'Invalid leadId — must be a UUID' }, { status: 400 });
  }

  try {
    const result = await db
      .select()
      .from(requirements)
      .where(
        and(
          eq(requirements.tenantId, ctx.tenantId),
          eq(requirements.leadId, leadIdParam),
        ),
      )
      .limit(1);

    return NextResponse.json({ data: result[0] ?? null });
  } catch (e) {
    console.error('[GET /api/v1/requirements]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/v1/requirements ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateRequirementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { leadId, roomName, stylePreference, budgetBandPaise, notes } = parsed.data;

  try {
    // Verify the lead belongs to this tenant
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Build the room entry to append to roomsJson
    const newRoom: RoomEntry = { name: roomName };
    if (stylePreference !== undefined) newRoom.stylePreference = stylePreference;
    if (budgetBandPaise !== undefined) newRoom.budgetBandPaise = budgetBandPaise;
    if (notes !== undefined) newRoom.notes = notes;

    // Check if a requirements row already exists for this lead
    const [existing] = await db
      .select()
      .from(requirements)
      .where(
        and(
          eq(requirements.tenantId, ctx.tenantId),
          eq(requirements.leadId, leadId),
        ),
      )
      .limit(1);

    if (existing) {
      // Append the new room to roomsJson
      const existingRooms = (existing.roomsJson as RoomEntry[]) ?? [];
      const updatedRooms = [...existingRooms, newRoom];

      const [updated] = await db
        .update(requirements)
        .set({ roomsJson: updatedRooms })
        .where(
          and(
            eq(requirements.id, existing.id),
            eq(requirements.tenantId, ctx.tenantId),
          ),
        )
        .returning();

      return NextResponse.json(
        { data: updated, message: 'Room requirement added' },
        { status: 201 },
      );
    }

    // No row yet — create one with this first room
    const [created] = await db
      .insert(requirements)
      .values({
        tenantId: ctx.tenantId,
        leadId,
        roomsJson: [newRoom],
      })
      .returning();

    return NextResponse.json(
      { data: created, message: 'Requirements created with first room' },
      { status: 201 },
    );
  } catch (e) {
    console.error('[POST /api/v1/requirements]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
