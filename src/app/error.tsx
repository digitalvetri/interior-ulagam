'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-red-600">
        Something went wrong
      </p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        We hit an unexpected error.
      </h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        The team has been notified. You can try again, or head back to the
        dashboard.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-gray-400">Ref: {error.digest}</p>
      )}
      <div className="mt-2 flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
