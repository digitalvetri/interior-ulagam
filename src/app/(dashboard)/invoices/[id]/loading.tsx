export default function InvoiceDetailLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gray-200" />
        <div className="space-y-1.5">
          <div className="h-6 w-48 rounded-lg bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-100" />
        </div>
        <div className="ml-auto flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-gray-100" />
          <div className="h-9 w-28 rounded-lg bg-gray-200" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-gray-100 p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 w-48 rounded bg-gray-100 flex-1" />
                <div className="h-4 w-20 rounded bg-gray-100" />
                <div className="h-4 w-16 rounded bg-gray-100" />
                <div className="h-4 w-24 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-48 rounded-2xl bg-gray-100" />
          <div className="h-32 rounded-2xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
