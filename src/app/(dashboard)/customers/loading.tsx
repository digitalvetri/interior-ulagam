export default function CustomersLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded-lg bg-[var(--surface-hover)]" />
        <div className="h-9 w-36 rounded-lg bg-[var(--surface-hover)]" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 flex-1 max-w-xs rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-10 w-32 rounded-lg bg-[var(--surface-muted)]" />
      </div>
      <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
        <div className="h-11 bg-[var(--surface-muted)]" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-[var(--border-subtle)]">
            <div className="h-9 w-9 rounded-full bg-[var(--surface-hover)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 rounded bg-[var(--surface-hover)]" />
              <div className="h-3 w-28 rounded bg-[var(--surface-muted)]" />
            </div>
            <div className="h-5 w-20 rounded-full bg-[var(--surface-muted)]" />
            <div className="h-8 w-8 rounded-lg bg-[var(--surface-muted)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
