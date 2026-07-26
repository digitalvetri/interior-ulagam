// Public portfolio page — no auth needed.
// Accessible at /portfolio/[id] — no dashboard sidebar.
export const dynamic = 'force-dynamic';

interface Portfolio {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  coverPhotoUrl: string | null;
  photos: string[];
  isPublic: boolean;
  clientConsent: boolean;
  createdAt: string;
}

async function getPortfolio(id: string): Promise<Portfolio | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/v1/portfolio/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const { data }: { data: Portfolio } = await res.json();
    return data;
  } catch {
    return null;
  }
}

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const portfolio = await getPortfolio(id);

  if (!portfolio || !portfolio.isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-center text-gray-500">
          This portfolio is private or does not exist.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Client consent banner — shown when clientConsent is true */}
      {portfolio.clientConsent && (
        <div className="bg-blue-50 px-4 py-2 text-center text-sm text-blue-700">
          Shared with client consent
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-gray-900">
            The Interior Studio
          </span>
          <h1 className="text-base font-semibold text-gray-700">
            {portfolio.title || 'Portfolio'}
          </h1>
        </div>
      </header>

      {/* Photo grid */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {portfolio.photos.length === 0 ? (
          <p className="text-center text-sm text-gray-400">
            No photos in this portfolio yet.
          </p>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {portfolio.photos.map((url, idx) => (
              <div key={idx} className="mb-4 break-inside-avoid">
                <img
                  src={url}
                  alt="Portfolio photo"
                  className="w-full rounded-lg object-cover"
                  loading={idx < 6 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-400">
        Powered by Interior Studio OS — DigitalVetri
      </footer>
    </div>
  );
}
