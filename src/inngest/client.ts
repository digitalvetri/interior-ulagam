import { Inngest } from 'inngest';

const _inngest = new Inngest({
  id: 'interior-studio-os',
  name: 'InterioOS',
});

// In local dev the Inngest event key is often absent. Rather than crash every
// route that fires an event (lead create, quote send, handover, webhooks…),
// swallow the send failure and log a warning. If INNGEST_EVENT_KEY *is* set
// but the send still fails, surface the real error.
const originalSend = _inngest.send.bind(_inngest);
_inngest.send = (async (...args: Parameters<typeof originalSend>) => {
  try {
    return await originalSend(...args);
  } catch (err) {
    if (!process.env.INNGEST_EVENT_KEY) {
      console.warn('[inngest] send skipped — INNGEST_EVENT_KEY not set:', (err as Error).message);
      return { ids: [] } as unknown as Awaited<ReturnType<typeof originalSend>>;
    }
    throw err;
  }
}) as typeof originalSend;

export const inngest = _inngest;
