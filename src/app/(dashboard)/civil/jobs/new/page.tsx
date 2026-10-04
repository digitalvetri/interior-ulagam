'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { JobEditor } from '@/components/civil/JobEditor';

function NewJob() {
  const router = useRouter();
  const branchId = useSearchParams().get('branchId') ?? undefined;

  return (
    <div className="p-6 space-y-5">
      <div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <Link href="/civil" className="hover:underline">Civil</Link>
          {' › '}
          <Link href="/civil/jobs" className="hover:underline">All Jobs</Link>
          {' › '}New
        </p>
        <h1 className="mt-1 text-2xl font-bold" style={{ color: 'var(--text-heading)' }}>New job</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          The job number is given automatically when you save.
        </p>
      </div>
      <JobEditor initialBranchId={branchId} onSaved={job => router.push(`/civil/jobs/${job.id}`)} />
    </div>
  );
}

export default function NewJobPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="skeleton h-8 w-40 rounded" /></div>}>
      <NewJob />
    </Suspense>
  );
}
