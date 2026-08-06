import { NextRequest } from 'next/server';
import postgres from 'postgres';
import { getAuthContext } from '@/lib/auth';

/**
 * Server-sent events stream of database changes — replaces Supabase Realtime.
 *
 * Postgres triggers (migration 0002) emit pg_notify on 'table_changes'; this
 * route LISTENs and forwards each event to the browser. Events for other
 * tenants are dropped here, so a client never learns that another studio's data
 * changed.
 *
 * LISTEN occupies its connection for as long as it is held, so this uses its own
 * single-socket client rather than borrowing from the app's shared pool.
 */
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000;

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response('Unauthorized', { status: 401 });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return new Response('Not configured', { status: 503 });

  const encoder = new TextEncoder();
  const sql = postgres(databaseUrl, { max: 1 });

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unlisten: (() => Promise<void>) | undefined;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // Stream already torn down by the client; cleanup handles the rest.
        }
      };

      const cleanup = async () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        try { await unlisten?.(); } catch { /* connection already gone */ }
        try { await sql.end({ timeout: 5 }); } catch { /* already closed */ }
        try { controller.close(); } catch { /* already closed */ }
      };

      request.signal.addEventListener('abort', () => void cleanup());

      try {
        const subscription = await sql.listen('table_changes', (payload) => {
          try {
            const event = JSON.parse(payload) as {
              table?: string;
              op?: string;
              tenantId?: string | null;
            };
            // Drop anything belonging to a different tenant.
            if (event.tenantId && event.tenantId !== ctx.tenantId) return;
            send(`data: ${JSON.stringify({ table: event.table, op: event.op })}\n\n`);
          } catch {
            // Malformed payload — ignore rather than kill the stream.
          }
        });
        unlisten = subscription.unlisten;
      } catch (err) {
        console.error('[events] LISTEN failed:', err);
        await cleanup();
        return;
      }

      // Tells the browser the stream is live, and keeps intermediaries from
      // closing an idle connection.
      send(': connected\n\n');
      heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
    },

    async cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      try { await unlisten?.(); } catch { /* ignore */ }
      try { await sql.end({ timeout: 5 }); } catch { /* ignore */ }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Stops nginx and similar proxies from buffering the stream.
      'X-Accel-Buffering': 'no',
    },
  });
}
