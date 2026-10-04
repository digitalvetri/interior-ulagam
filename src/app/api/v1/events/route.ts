import { NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { subscribe } from '@/lib/realtime/listener';

/**
 * Server-sent events stream of database changes — replaces Supabase Realtime.
 *
 * Postgres triggers (migration 0002) emit pg_notify on 'table_changes'; a single
 * shared listener per process (src/lib/realtime/listener.ts) receives them and
 * fans them out to every open stream. Events for other tenants are dropped
 * here, so a client never learns that another studio's data changed.
 *
 * This route previously opened its own Postgres connection per request, which
 * made connection count scale with concurrent viewers and could starve the pool
 * the rest of the application depends on.
 */
export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000;

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response('Unauthorized', { status: 401 });

  if (!process.env.DATABASE_URL) return new Response('Not configured', { status: 503 });

  const encoder = new TextEncoder();

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;
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

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try { controller.close(); } catch { /* already closed */ }
      };

      request.signal.addEventListener('abort', cleanup);

      try {
        unsubscribe = await subscribe((event) => {
          // Fail closed: an event with no tenant belongs to nobody, so it goes
          // to nobody. The previous `event.tenantId && ...` form skipped the
          // check on a null tenant and broadcast to every connected client.
          if (event.tenantId !== ctx.tenantId) return;
          send(`data: ${JSON.stringify({ table: event.table, op: event.op })}\n\n`);
        });
      } catch (err) {
        console.error('[events] LISTEN failed:', err);
        cleanup();
        return;
      }

      // Tells the browser the stream is live, and keeps intermediaries from
      // closing an idle connection.
      send(': connected\n\n');
      heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
    },

    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
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
