export default function MaterialsLoading() {
  return (
    <div className="space-y-5 p-6">
      <div
        className="flex items-end justify-between gap-4 pb-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="space-y-2">
          <div className="skeleton h-6 w-44" />
          <div className="skeleton h-4 w-40" />
        </div>
        <div className="skeleton h-9 w-32 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <div className="skeleton h-10 w-64 rounded-lg" />
        <div className="skeleton h-10 w-20 rounded-lg" />
      </div>
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-7 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="overflow-hidden"
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
            }}
          >
            <div className="skeleton h-32 rounded-none" />
            <div className="space-y-2 p-3">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
