import { randomUUID } from 'crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PO line ids are referenced by GRNs (grns.line_id is a uuid column), so the
 * server owns them: any line arriving without a UUID id gets one. The browser's
 * ids are only React keys and must never become the stored id.
 */
export function withServerLineIds<T extends Record<string, unknown>>(lines: T[]): T[] {
  return lines.map((l) => (typeof l.id === 'string' && UUID.test(l.id) ? l : { ...l, id: randomUUID() }));
}
