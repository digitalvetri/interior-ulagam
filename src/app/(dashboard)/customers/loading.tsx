export default function CustomersLoading() {
  return (
    <div className="space-y-5 p-6">
      <div
        className="flex items-end justify-between gap-4 pb-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="space-y-2">
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-4 w-56" />
        </div>
        <div className="skeleton h-9 w-36 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <div className="skeleton h-10 flex-1 max-w-md rounded-lg" />
        <div className="skeleton h-10 w-32 rounded-lg" />
      </div>
      <div
        className="overflow-hidden"
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
        }}
      >
        <div className="h-10" style={{ background: 'var(--surface-muted)' }} />
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <div className="skeleton h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-3 w-28" />
            </div>
            <div className="skeleton h-5 w-20 rounded-full" />
            <div className="skeleton h-7 w-7 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
