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
    console.error('[client portal error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        We couldn&rsquo;t load this page.
      </h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        The link may be invalid or expired. If your designer shared this with
        you, please ask them for a fresh link.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
      >
        Try again
      </button>
    </div>
  );
}
