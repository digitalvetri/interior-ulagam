export default function QuotesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-lg bg-gray-200" />
        <div className="h-9 w-28 rounded-lg bg-gray-200" />
      </div>
      <div className="rounded-2xl overflow-hidden border border-gray-100">
        <div className="h-11 bg-gray-50" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-gray-100">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="h-4 w-8 rounded bg-gray-100" />
            <div className="h-4 flex-1 rounded bg-gray-100" />
            <div className="h-5 w-16 rounded-full bg-gray-100" />
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="h-4 w-20 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
