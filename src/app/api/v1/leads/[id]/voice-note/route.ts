import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { getAuthContext } from '@/lib/auth';
import { groqProvider } from '@/lib/ai';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB — Whisper's hard limit

// ─── POST /api/v1/leads/[id]/voice-note ───────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, ctx.tenantId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected multipart/form-data with an audio field' }, { status: 400 });
    }

    const audioFile = form.get('audio');
    if (!(audioFile instanceof File)) {
      return NextResponse.json({ error: 'audio field is required (File)' }, { status: 400 });
    }

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio file too large (max 25 MB)' }, { status: 413 });
    }

    const audioBuffer = await audioFile.arrayBuffer();
    const transcript = await groqProvider.transcribeBlob(
      audioBuffer,
      audioFile.name || 'voice-note.webm',
    );

    return NextResponse.json({ data: { transcript } });
  } catch (e) {
    console.error('[POST /api/v1/leads/[id]/voice-note]', e);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
