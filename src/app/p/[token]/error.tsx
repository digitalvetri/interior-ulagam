'use client';

import { useEffect } from 'react';

export default function ClientPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ClientPortal]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-stone-50">
      <div className="max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🔗</div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Link unavailable</h1>
        <p className="text-sm text-gray-500 mb-6">
          This project link may have expired or been revoked. Please ask your designer for a new link.
        </p>
        <button onClick={reset} className="text-sm font-medium underline" style={{ color: '#C89B3C' }}>
          Try again
        </button>
      </div>
    </div>
  );
}
