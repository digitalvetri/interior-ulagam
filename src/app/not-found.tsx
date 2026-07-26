import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        404
      </p>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Page not found
      </h1>
      <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
