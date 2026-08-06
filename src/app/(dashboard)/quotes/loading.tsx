export default function QuotesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-lg bg-[var(--surface-hover)]" />
        <div className="h-9 w-28 rounded-lg bg-[var(--surface-hover)]" />
      </div>
      <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)]">
        <div className="h-11 bg-[var(--surface-muted)]" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-[var(--border-subtle)]">
            <div className="h-4 w-20 rounded bg-[var(--surface-hover)]" />
            <div className="h-4 w-8 rounded bg-[var(--surface-muted)]" />
            <div className="h-4 flex-1 rounded bg-[var(--surface-muted)]" />
            <div className="h-5 w-16 rounded-full bg-[var(--surface-muted)]" />
            <div className="h-4 w-20 rounded bg-[var(--surface-hover)]" />
            <div className="h-4 w-20 rounded bg-[var(--surface-muted)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
