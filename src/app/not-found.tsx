import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ background: '#F8F5F2' }}>
      <div className="premium-card max-w-md w-full text-center p-8">
        <p className="text-6xl font-black mb-4" style={{ color: '#C89B3C' }}>404</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/dashboard" className="btn-primary inline-block">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
