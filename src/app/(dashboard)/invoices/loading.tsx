export default function InvoicesLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-lg bg-gray-200" />
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-56 rounded-lg bg-gray-100" />
        <div className="h-10 w-28 rounded-lg bg-gray-100" />
      </div>
      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="h-11 bg-gray-100" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-t border-gray-50">
            <div className="h-4 w-24 rounded bg-gray-200" />
            <div className="h-4 w-40 rounded bg-gray-100 flex-1" />
            <div className="h-4 w-20 rounded bg-gray-100" />
            <div className="h-5 w-16 rounded-full bg-gray-200" />
            <div className="h-4 w-24 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
