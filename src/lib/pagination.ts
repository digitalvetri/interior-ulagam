import { NextRequest } from 'next/server';

/**
 * Bounds for list endpoints.
 *
 * Five of the six core list routes previously selected every row in the table
 * and serialised the lot to the browser — invisible at a handful of rows, a
 * page-killer at ten thousand, and a way for any authenticated caller to pin
 * the database with one request.
 *
 * The default is deliberately a *ceiling*, not a page size. No list page sends
 * `?limit=` or renders pagination yet, so a small default would silently drop
 * rows off the end of the screen with nothing to say so — which is worse than
 * the unbounded query it replaced, because it looks like data loss. Until the
 * pages gain real pagination, the job here is to stop a pathological query,
 * not to page results.
 *
 * `hasMore` on the response makes any truncation that does happen visible
 * rather than silent.
 */
export const DEFAULT_LIMIT = 500;
export const MAX_LIMIT = 1000;

export interface ListRange {
  limit: number;
  offset: number;
}

export function listRange(request: NextRequest): ListRange {
  const params = request.nextUrl.searchParams;

  const rawLimit = Number(params.get('limit'));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const rawOffset = Number(params.get('offset'));
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}

/**
 * One extra row is fetched beyond the limit purely to answer "is there more?"
 * without paying for a second COUNT query. Call this to drop it again.
 */
export function takePage<T>(rows: T[], range: ListRange): { page: T[]; hasMore: boolean } {
  const hasMore = rows.length > range.limit;
  return { page: hasMore ? rows.slice(0, range.limit) : rows, hasMore };
}
