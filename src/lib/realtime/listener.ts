import postgres from 'postgres';

/**
 * One Postgres LISTEN connection per process, fanned out to every SSE stream.
 *
 * The /api/v1/events route used to call postgres(url, { max: 1 }) inside the
 * request handler, and LISTEN holds its socket for the life of the stream. That
 * made connections scale with *viewers*: ten people with the app open meant ten
 * Postgres connections, and the server's max_connections is 100. The failure at
 * that ceiling is not "realtime stops" — it is every query in the application
 * failing to acquire a connection, because the pool is starved.
 *
 * pg_notify broadcasts to all listeners, so a shared connection per process
 * stays correct across replicas: each process gets every event and filters it
 * for its own subscribers.
 */
export interface TableChangeEvent {
  table?: string;
  op?: string;
  tenantId?: string | null;
}

type Subscriber = (event: TableChangeEvent) => void;

const CHANNEL = 'table_changes';

const subscribers = new Set<Subscriber>();

let client: postgres.Sql | null = null;
let unlisten: (() => Promise<void>) | null = null;
/** In-flight connect, so concurrent first requests share one attempt. */
let connecting: Promise<void> | null = null;

function dispatch(payload: string): void {
  let event: TableChangeEvent;
  try {
    event = JSON.parse(payload) as TableChangeEvent;
  } catch {
    return; // Malformed payload — ignore rather than tear every stream down.
  }
  for (const notify of subscribers) {
    try {
      notify(event);
    } catch {
      // One bad subscriber must not stop the others from being told.
    }
  }
}

async function connect(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, {
    max: 1,
    // A listener that reconnects silently is the point of this module; without
    // this the first network blip ends realtime for the whole process.
    onnotice: () => {},
  });
  const subscription = await sql.listen(CHANNEL, dispatch, () => {
    // Called on (re)connect. Nothing to replay: clients hold a polling
    // fallback, so a gap costs at most one poll interval.
  });
  client = sql;
  unlisten = subscription.unlisten;
}

/**
 * Add a subscriber and return its unsubscribe function.
 *
 * The connection is opened on the first subscriber and closed when the last one
 * leaves, so an idle server holds no listener.
 */
export async function subscribe(notify: Subscriber): Promise<() => void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  subscribers.add(notify);

  try {
    if (!client) {
      connecting ??= connect(databaseUrl).finally(() => {
        connecting = null;
      });
      await connecting;
    }
  } catch (err) {
    subscribers.delete(notify);
    throw err;
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    subscribers.delete(notify);
    if (subscribers.size === 0) void teardown();
  };
}

async function teardown(): Promise<void> {
  // A late subscriber may have arrived between the check and here.
  if (subscribers.size > 0) return;

  const sql = client;
  const stop = unlisten;
  client = null;
  unlisten = null;

  try { await stop?.(); } catch { /* connection already gone */ }
  try { await sql?.end({ timeout: 5 }); } catch { /* already closed */ }
}

/** Test and diagnostic aid — how many streams this process is serving. */
export function subscriberCount(): number {
  return subscribers.size;
}
