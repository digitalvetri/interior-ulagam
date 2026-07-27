export default function CustomersLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded-lg bg-gray-200" />
        <div className="h-9 w-36 rounded-lg bg-gray-200" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 flex-1 max-w-xs rounded-lg bg-gray-100" />
        <div className="h-10 w-32 rounded-lg bg-gray-100" />
      </div>
      <div className="rounded-2xl overflow-hidden border border-gray-100">
        <div className="h-11 bg-gray-50" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-gray-100">
            <div className="h-9 w-9 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-3 w-28 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-20 rounded-full bg-gray-100" />
            <div className="h-8 w-8 rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
