export default function ProjectsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-lg bg-[var(--surface-hover)]" />
        <div className="h-9 w-32 rounded-lg bg-[var(--surface-hover)]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--border-subtle)] p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="h-5 w-36 rounded bg-[var(--surface-hover)]" />
              <div className="h-5 w-20 rounded-full bg-[var(--surface-muted)]" />
            </div>
            <div className="h-3 w-28 rounded bg-[var(--surface-muted)]" />
            <div className="h-2 w-full rounded-full bg-[var(--surface-muted)]" />
            <div className="flex gap-2">
              <div className="h-4 w-16 rounded bg-[var(--surface-muted)]" />
              <div className="h-4 w-16 rounded bg-[var(--surface-muted)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
