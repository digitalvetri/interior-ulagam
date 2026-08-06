export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-[var(--surface-hover)]" />
          <div className="h-4 w-64 rounded bg-[var(--surface-muted)]" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-[var(--surface-hover)]" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-[var(--surface-muted)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-72 rounded-2xl bg-[var(--surface-muted)]" />
      </div>
    </div>
  );
}
