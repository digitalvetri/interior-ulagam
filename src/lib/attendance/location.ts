import { z } from 'zod';

/** Location body sent by check-in / check-out. Every field is optional: no GPS still records attendance. */
export const AttendanceLocationSchema = z.object({
  latitude:  z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  /** Browser-reported accuracy radius in metres. */
  accuracy:  z.number().nonnegative().max(1_000_000).optional(),
  address:   z.string().max(500).optional(),
});

export type AttendanceLocation = z.infer<typeof AttendanceLocationSchema>;

interface NominatimReverse {
  display_name?: string;
}

/**
 * Human-readable address for a coordinate via OpenStreetMap Nominatim.
 * Returns null on any failure — a slow or failed lookup must never block attendance.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'KonstDesignCRM/1.0 (info@digitalvetri.com)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as NominatimReverse;
    const name = json.display_name?.trim();
    return name ? name.slice(0, 500) : null;
  } catch {
    return null;
  }
}

/** Columns-ready values: lat/lng as decimal strings, accuracy rounded to whole metres, resolved address. */
export async function resolveLocation(loc: AttendanceLocation): Promise<{
  latitude: string | null;
  longitude: string | null;
  accuracyM: number | null;
  address: string | null;
}> {
  const { latitude, longitude, accuracy, address } = loc;
  if (latitude === undefined || longitude === undefined) {
    return { latitude: null, longitude: null, accuracyM: null, address: null };
  }
  const resolved = await reverseGeocode(latitude, longitude);
  return {
    latitude:  latitude.toString(),
    longitude: longitude.toString(),
    accuracyM: accuracy !== undefined ? Math.round(accuracy) : null,
    address:   resolved ?? address ?? null,
  };
}
