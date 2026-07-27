import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { db } from '@/lib/db';
import { leads, waMessages } from '@/lib/db/schema';
import { checkRateLimit, webhookLimiter } from '@/lib/ratelimit';

// ─── Webhook payload types ─────────────────────────────────────────────────────

interface WaTextContent {
  body: string;
}

interface WaImageContent {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

interface WaNfmReply {
  response_json: string;
  name: string;
  body?: string;
}

interface WaInteractiveContent {
  type: string;
  nfm_reply?: WaNfmReply;
}

interface WaMessageEntry {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: WaTextContent;
  image?: WaImageContent;
  interactive?: WaInteractiveContent;
}

interface WaStatusEntry {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

interface WaValue {
  messaging_product: string;
  metadata?: { phone_number_id: string; display_phone_number: string };
  messages?: WaMessageEntry[];
  statuses?: WaStatusEntry[];
}

interface WaWebhookPayload {
  object: string;
  entry?: Array<{
    id: string;
    changes?: Array<{ value: WaValue; field: string }>;
  }>;
}

interface MetaMediaUrlResponse {
  url: string;
  mime_type?: string;
  sha256?: string;
  file_size?: number;
  id?: string;
  messaging_product?: string;
}

// ─── GET: Meta webhook verification handshake ──────────────────────────────────

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ─── POST: Inbound messages and delivery statuses ─────────────────────────────

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(webhookLimiter, request);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.text();

  // Verify X-Hub-Signature-256
  const signature = request.headers.get('x-hub-signature-256');
  if (!signature || !process.env.WHATSAPP_APP_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const expectedSig =
    'sha256=' +
    crypto
      .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
      .update(body)
      .digest('hex');

  // Use timing-safe comparison to prevent timing attacks.
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  const signatureValid =
    sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  if (!signatureValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body) as WaWebhookPayload;

  // Collect every inbound message phone number from the payload
  const inboundPhones: string[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value.messages ?? []) {
        if (message.from) inboundPhones.push(message.from);
      }
    }
  }

  if (inboundPhones.length > 0) {
    // Fire lead/replied for each (tenantId, contactPhone) pair so cancelOn
    // in leadFollowupNudge can match correctly.
    //
    // WhatsApp sends phone numbers as full international strings without "+"
    // (e.g. "919876543210"). leads.contactPhone may be stored with or without
    // the country-code prefix, so we match on the raw string first.
    await Promise.all(
      inboundPhones.map(async (phone) => {
        const matchedLeads = await db
          .select({ id: leads.id, tenantId: leads.tenantId })
          .from(leads)
          .where(eq(leads.contactPhone, phone));

        // Write inbound message to wa_messages + fire lead/replied + rescore
        await Promise.all(
          matchedLeads.map(async (row) => {
            // Find the message text for this phone from the payload
            let bodyPreview: string | null = null;
            let metaMessageId: string | null = null;
            for (const entry of payload.entry ?? []) {
              for (const change of entry.changes ?? []) {
                for (const msg of change.value.messages ?? []) {
                  if (msg.from === phone) {
                    bodyPreview = msg.text?.body ?? msg.image?.caption ?? null;
                    metaMessageId = msg.id ?? null;
                  }
                }
              }
            }

            await db.insert(waMessages).values({
              tenantId: row.tenantId,
              leadId: row.id,
              threadId: phone,
              metaMessageId,
              direction: 'inbound',
              bodyPreview: bodyPreview ? bodyPreview.slice(0, 500) : null,
            }).onConflictDoNothing();

            // Update lastActivityAt on the lead — inbound WA IS human activity
            await db
              .update(leads)
              .set({ lastActivityAt: new Date() })
              .where(eq(leads.id, row.id));

            await Promise.all([
              inngest.send({ name: 'lead/replied', data: { tenantId: row.tenantId, contactPhone: phone } }),
              inngest.send({ name: 'lead/score.compute', data: { leadId: row.id, tenantId: row.tenantId } }),
            ]);
          }),
        );
      }),
    );
  }

  // ─── Extended event firing: language detection, chatbot, image, flows ────────

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value.messages ?? []) {
        const messageText = message.text?.body ?? '';
        const from = message.from;
        const messageType = message.type;

        // Fire language detection on first non-empty text message,
        // and fire client chatbot for all client text queries.
        if (messageType === 'text' && messageText.trim().length > 5) {
          const [lead] = await db
            .selectDistinct({
              id: leads.id,
              tenantId: leads.tenantId,
              preferredLanguage: leads.preferredLanguage,
            })
            .from(leads)
            .where(eq(leads.contactPhone, from))
            .limit(1);

          if (lead && !lead.preferredLanguage) {
            // First message — detect language and persist it
            await inngest.send({
              name: 'lead/first_message.received',
              data: { leadId: lead.id, tenantId: lead.tenantId, messageText },
            });
          }

          if (lead) {
            // Answer or escalate the client query via AI chatbot
            await inngest.send({
              name: 'wa_message/client_query.received',
              data: {
                tenantId: lead.tenantId,
                contactPhone: from,
                messageText,
                leadId: lead.id,
              },
            });
          }
        }

        // Fire image event for AI BOQ draft pipeline
        if (messageType === 'image') {
          const imageId = message.image?.id;
          if (imageId) {
            const urlRes = await fetch(
              `https://graph.facebook.com/v21.0/${imageId}`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                },
              },
            );
            const urlData = (await urlRes.json()) as MetaMediaUrlResponse;

            const [lead2] = await db
              .selectDistinct({ id: leads.id, tenantId: leads.tenantId })
              .from(leads)
              .where(eq(leads.contactPhone, from))
              .limit(1);

            if (lead2 && urlData.url) {
              await inngest.send({
                name: 'wa_message/image.received',
                data: {
                  imageUrl: urlData.url,
                  leadId: lead2.id,
                  tenantId: lead2.tenantId,
                  contactPhone: from,
                },
              });
            }
          }
        }

        // Parse WhatsApp Flow responses (nfm_reply interactive messages)
        if (
          messageType === 'interactive' &&
          message.interactive?.type === 'nfm_reply'
        ) {
          const flowResponse = message.interactive.nfm_reply;
          if (flowResponse) {
            await inngest.send({
              name: 'wa_flow/response.received',
              data: {
                tenantId: 'unknown',
                contactPhone: from,
                flowToken: flowResponse.response_json,
                flowName: flowResponse.name,
              },
            });
          }
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
