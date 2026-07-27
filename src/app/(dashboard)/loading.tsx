export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div
        className="flex items-end justify-between gap-4 pb-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="space-y-2">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-4 w-72" />
        </div>
        <div className="skeleton h-9 w-28 rounded-lg" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="p-4 space-y-3"
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
            }}
          >
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-8 w-20" />
            <div className="skeleton h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Two-column content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="p-5 space-y-4"
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
            }}
          >
            <div className="skeleton h-4 w-32" />
            {[...Array(4)].map((__, j) => (
              <div key={j} className="skeleton h-9 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
