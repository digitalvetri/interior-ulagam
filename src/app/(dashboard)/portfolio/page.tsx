'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PortfolioListItem {
  id: string;
  projectId: string;
  title: string;
  coverPhotoUrl: string | null;
  isPublic: boolean;
  clientConsent: boolean;
  photosCount: number;
  createdAt: string;
}

interface PortfolioDetail extends PortfolioListItem {
  photos: string[];
}

export default function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<PortfolioListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPortfolio, setModalPortfolio] = useState<PortfolioDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Toggling state — track which portfolio ids are in-flight
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/portfolio')
      .then((r) => r.json())
      .then(({ data }: { data: PortfolioListItem[] }) => {
        setPortfolios(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const patch = useCallback(
    async (id: string, patch: { isPublic?: boolean; clientConsent?: boolean }) => {
      if (toggling.has(id)) return;
      setToggling((prev) => new Set(prev).add(id));

      try {
        const res = await fetch(`/api/v1/portfolio/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });

        if (!res.ok) {
          console.error('[portfolio PATCH] failed', await res.text());
          return;
        }

        const { data: updated }: { data: PortfolioDetail } = await res.json();
        setPortfolios((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  isPublic: updated.isPublic,
                  clientConsent: updated.clientConsent,
                }
              : p,
          ),
        );
      } finally {
        setToggling((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [toggling],
  );

  const openModal = useCallback(async (portfolio: PortfolioListItem) => {
    setModalOpen(true);
    setModalLoading(true);
    setModalPortfolio(null);

    try {
      const res = await fetch(`/api/v1/portfolio/${portfolio.id}`);
      if (!res.ok) throw new Error('Failed to load portfolio');
      const { data }: { data: PortfolioDetail } = await res.json();
      setModalPortfolio(data);
    } catch {
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  }, []);

  const copyShareLink = useCallback((id: string) => {
    const url =
      (process.env.NEXT_PUBLIC_APP_URL ?? '') + '/portfolio/' + id;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback(id);
      setTimeout(() => setCopyFeedback(null), 2000);
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Portfolio
        </h2>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-gray-500">Loading portfolios…</p>
        </div>
      ) : portfolios.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-sm text-gray-500">No portfolios yet.</p>
          <p className="text-xs text-gray-400">
            Portfolios are automatically created when a project reaches handover.
          </p>
        </div>
      ) : (
        /* Masonry-style grid using CSS columns */
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className="mb-4 break-inside-avoid rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              {/* Cover photo */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-gray-100 dark:bg-gray-800">
                {portfolio.coverPhotoUrl ? (
                  <Image
                    src={portfolio.coverPhotoUrl}
                    alt={portfolio.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-xs text-gray-400">No cover photo</span>
                  </div>
                )}
                {/* Title overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                  <p className="truncate text-sm font-semibold text-white">
                    {portfolio.title || 'Untitled Portfolio'}
                  </p>
                </div>
              </div>

              {/* Card body */}
              <div className="p-3 space-y-3">
                {/* Badges row */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant={portfolio.isPublic ? 'default' : 'secondary'}
                    className={
                      portfolio.isPublic
                        ? 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }
                  >
                    {portfolio.isPublic ? 'Public' : 'Private'}
                  </Badge>

                  {portfolio.clientConsent && (
                    <Badge
                      variant="outline"
                      className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
                    >
                      Client Consent
                    </Badge>
                  )}

                  <Badge variant="outline" className="text-gray-500">
                    {portfolio.photosCount} photo
                    {portfolio.photosCount !== 1 ? 's' : ''}
                  </Badge>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openModal(portfolio)}
                  >
                    View
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={toggling.has(portfolio.id)}
                    onClick={() =>
                      patch(portfolio.id, { isPublic: !portfolio.isPublic })
                    }
                  >
                    {portfolio.isPublic ? 'Make Private' : 'Make Public'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={toggling.has(portfolio.id)}
                    onClick={() =>
                      patch(portfolio.id, {
                        clientConsent: !portfolio.clientConsent,
                      })
                    }
                  >
                    {portfolio.clientConsent
                      ? 'Remove Consent'
                      : 'Mark Consent'}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyShareLink(portfolio.id)}
                    disabled={!portfolio.isPublic}
                    title={
                      portfolio.isPublic
                        ? 'Copy share link'
                        : 'Make portfolio public first'
                    }
                  >
                    {copyFeedback === portfolio.id ? 'Copied!' : 'Copy Link'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>
              {modalPortfolio?.title || 'Portfolio Photos'}
            </DialogTitle>
          </DialogHeader>

          {modalLoading ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-gray-500">Loading photos…</p>
            </div>
          ) : modalPortfolio && modalPortfolio.photos.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-gray-500">No photos in this portfolio.</p>
            </div>
          ) : (
            <div className="columns-2 gap-3 sm:columns-3 max-h-[70vh] overflow-y-auto pr-1">
              {modalPortfolio?.photos.map((url, idx) => (
                <div key={idx} className="mb-3 break-inside-avoid">
                  <Image
                    src={url}
                    alt={`Portfolio photo ${idx + 1}`}
                    width={0}
                    height={0}
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="h-auto w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
