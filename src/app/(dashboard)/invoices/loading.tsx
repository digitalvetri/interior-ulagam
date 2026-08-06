export default function InvoicesLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-lg bg-[var(--surface-hover)]" />
        <div className="h-9 w-32 rounded-lg bg-[var(--surface-hover)]" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-56 rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-10 w-28 rounded-lg bg-[var(--surface-muted)]" />
      </div>
      <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
        <div className="h-11 bg-[var(--surface-muted)]" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-t border-[var(--border-subtle)]">
            <div className="h-4 w-24 rounded bg-[var(--surface-hover)]" />
            <div className="h-4 w-40 rounded bg-[var(--surface-muted)] flex-1" />
            <div className="h-4 w-20 rounded bg-[var(--surface-muted)]" />
            <div className="h-5 w-16 rounded-full bg-[var(--surface-hover)]" />
            <div className="h-4 w-24 rounded bg-[var(--surface-muted)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
