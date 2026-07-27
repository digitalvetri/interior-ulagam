export default function ProjectsLoading() {
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
        <div className="skeleton h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="space-y-3 p-4"
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
            }}
          >
            <div className="flex items-start justify-between">
              <div className="skeleton h-5 w-36" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-2 w-full rounded-full" />
            <div className="flex gap-2">
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
