export default function QuoteDetailLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-[var(--surface-hover)]" />
        <div className="space-y-1.5">
          <div className="h-6 w-52 rounded-lg bg-[var(--surface-hover)]" />
          <div className="h-4 w-36 rounded bg-[var(--surface-muted)]" />
        </div>
        <div className="ml-auto flex gap-2">
          <div className="h-9 w-20 rounded-lg bg-[var(--surface-muted)]" />
          <div className="h-9 w-24 rounded-lg bg-[var(--surface-muted)]" />
          <div className="h-9 w-28 rounded-lg bg-[var(--surface-hover)]" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            <div className="h-10 bg-[var(--surface-muted)]" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 px-5 py-3 border-t border-[var(--border-subtle)]">
                <div className="h-4 w-32 rounded bg-[var(--surface-muted)] flex-1" />
                <div className="h-4 w-12 rounded bg-[var(--surface-muted)]" />
                <div className="h-4 w-20 rounded bg-[var(--surface-muted)]" />
                <div className="h-4 w-20 rounded bg-[var(--surface-muted)]" />
                <div className="h-4 w-20 rounded bg-[var(--surface-hover)]" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-52 rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}
