/**
 * Browser-side precise location for attendance check-in / check-out.
 * Never rejects: a failure resolves with a user-facing reason so attendance
 * can still be recorded without a location.
 */

export interface PreciseLocation {
  latitude: number;
  longitude: number;
  /** Accuracy radius in metres, as reported by the device. */
  accuracy: number;
}

export type GeolocateResult =
  | { ok: true; location: PreciseLocation }
  | { ok: false; message: string };

const MESSAGES = {
  unsupported: 'This browser cannot share location — attendance was recorded without where you were.',
  insecure:    'Location needs a secure (https) connection — attendance was recorded without where you were.',
  denied:      'Location blocked — allow location for this site to record where you checked in.',
  unavailable: 'Your location could not be found (turn on GPS / location services) — recorded without location.',
  timeout:     'Getting your location took too long — recorded without location.',
} as const;

export function getPreciseLocation(): Promise<GeolocateResult> {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve({ ok: false, message: MESSAGES.unsupported });
  }
  if (!window.isSecureContext) {
    return Promise.resolve({ ok: false, message: MESSAGES.insecure });
  }
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        ok: true,
        location: {
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
        },
      }),
      err => resolve({
        ok: false,
        message: err.code === err.PERMISSION_DENIED ? MESSAGES.denied
          : err.code === err.TIMEOUT ? MESSAGES.timeout
          : MESSAGES.unavailable,
      }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

/** Google Maps link for a stored coordinate pair (decimal strings from the DB). */
export function mapsUrl(lat: string | number, lng: string | number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
