export default function LeadsLoading() {
  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div
        className="flex items-end justify-between gap-4 pb-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="space-y-2">
          <div className="skeleton h-6 w-32" />
          <div className="skeleton h-4 w-48" />
        </div>
        <div className="skeleton h-9 w-28 rounded-lg" />
      </div>

      {/* Search + filter row */}
      <div className="flex gap-3">
        <div className="skeleton h-10 flex-1 max-w-md rounded-lg" />
        <div className="skeleton h-10 w-32 rounded-lg" />
        <div className="skeleton h-10 w-24 rounded-lg" />
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, col) => (
          <div key={col} className="space-y-3">
            <div className="skeleton h-6 w-24" />
            {[...Array(3)].map((_, card) => (
              <div
                key={card}
                className="h-28"
                style={{
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
