/**
 * Small browser-side helpers for reporting failed actions to the user.
 * Client components only — never import from server code.
 */

/** A user-facing message for a failed fetch Response; prefers the server's `{ error }`. */
export async function responseError(res: Response, fallback = 'Something went wrong. Please try again.'): Promise<string> {
  let message: string | undefined;
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'error' in body) {
      const err = (body as { error: unknown }).error;
      if (typeof err === 'string' && err.trim()) message = err;
      else if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
        message = (err as { message: string }).message;
      }
    }
  } catch {
    // body was not JSON — fall through to the status-based message
  }
  // A bare "Forbidden" tells the user nothing; the 403s here are owner-only gates.
  if (res.status === 403 && (!message || /^forbidden\.?$/i.test(message.trim()))) return 'Only the studio owner can do this.';
  if (message) return message;
  if (res.status === 401) return 'Your session has expired. Please sign in again.';
  return fallback;
}

export const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.';

/**
 * Copies text to the clipboard. Returns false when the browser blocks it
 * (e.g. plain-http origins, where navigator.clipboard is undefined).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
