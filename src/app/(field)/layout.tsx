import type { Metadata, Viewport } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'InterioOS Field',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'InterioOS',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#111827',
};

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col bg-gray-50"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-gray-900 px-5 py-4 shadow-sm">
        <Image
          src="/brand/logo-icon.png"
          alt="Interior Studio"
          width={28}
          height={28}
          className="rounded"
          priority
        />
        <span className="text-sm font-semibold tracking-widest text-white">
          INTERIOR STUDIO
        </span>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
