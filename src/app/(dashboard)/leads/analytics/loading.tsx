export default function LeadsAnalyticsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-gray-200" />
          <div className="h-4 w-36 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-24 rounded-lg bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 p-5 space-y-2">
            <div className="h-4 w-20 rounded bg-gray-100" />
            <div className="h-8 w-16 rounded-lg bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-gray-100" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-52 rounded-2xl bg-gray-100" />
        <div className="h-52 rounded-2xl bg-gray-100" />
      </div>
    </div>
  );
}
