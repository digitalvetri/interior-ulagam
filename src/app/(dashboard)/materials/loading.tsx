export default function MaterialsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-44 rounded-lg bg-gray-200" />
          <div className="h-4 w-28 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-64 rounded-lg bg-gray-100" />
        <div className="h-10 w-20 rounded-lg bg-gray-100" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 w-28 rounded-full bg-gray-100 flex-shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl overflow-hidden border border-gray-100">
            <div className="h-40 bg-gray-100" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="h-3 w-20 rounded bg-gray-100" />
              <div className="h-5 w-24 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
