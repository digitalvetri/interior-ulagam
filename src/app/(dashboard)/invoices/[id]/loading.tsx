export default function InvoiceDetailLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-[var(--surface-hover)]" />
        <div className="space-y-1.5">
          <div className="h-6 w-48 rounded-lg bg-[var(--surface-hover)]" />
          <div className="h-4 w-32 rounded bg-[var(--surface-muted)]" />
        </div>
        <div className="ml-auto flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-[var(--surface-muted)]" />
          <div className="h-9 w-28 rounded-lg bg-[var(--surface-hover)]" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-48 rounded bg-[var(--surface-muted)] flex-1" />
                <div className="h-4 w-20 rounded bg-[var(--surface-muted)]" />
                <div className="h-4 w-16 rounded bg-[var(--surface-muted)]" />
                <div className="h-4 w-24 rounded bg-[var(--surface-hover)]" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-48 rounded-2xl bg-[var(--surface-muted)]" />
          <div className="h-32 rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}
