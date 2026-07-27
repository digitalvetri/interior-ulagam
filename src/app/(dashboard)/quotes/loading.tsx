export default function QuotesLoading() {
  return (
    <div className="space-y-5 p-6">
      <div
        className="flex items-end justify-between gap-4 pb-4"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="space-y-2">
          <div className="skeleton h-6 w-36" />
          <div className="skeleton h-4 w-52" />
        </div>
        <div className="skeleton h-9 w-28 rounded-lg" />
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
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-8" />
            <div className="skeleton h-4 flex-1" />
            <div className="skeleton h-5 w-16 rounded-full" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
