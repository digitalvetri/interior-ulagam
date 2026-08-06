export default function MaterialsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-44 rounded-lg bg-[var(--surface-hover)]" />
          <div className="h-4 w-28 rounded bg-[var(--surface-muted)]" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-[var(--surface-hover)]" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-64 rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-10 w-20 rounded-lg bg-[var(--surface-muted)]" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-28 rounded-full bg-[var(--surface-muted)] flex-shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
            <div className="h-40 bg-[var(--surface-muted)]" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-32 rounded bg-[var(--surface-hover)]" />
              <div className="h-3 w-20 rounded bg-[var(--surface-muted)]" />
              <div className="h-5 w-24 rounded bg-[var(--surface-hover)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
