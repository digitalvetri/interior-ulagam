export default function LeadsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-[var(--surface-hover)]" />
          <div className="h-4 w-32 rounded bg-[var(--surface-muted)]" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-[var(--surface-hover)]" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-64 rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-10 w-32 rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-10 w-32 rounded-lg bg-[var(--surface-muted)]" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, col) => (
          <div key={col} className="space-y-3">
            <div className="h-8 rounded-lg bg-[var(--surface-hover)]" />
            {[...Array(3)].map((_, card) => (
              <div key={card} className="h-32 rounded-xl bg-[var(--surface-muted)]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
