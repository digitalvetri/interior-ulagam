export default function AccountsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-lg bg-gray-200" />
        <div className="h-9 w-28 rounded-lg bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 p-5 space-y-2">
            <div className="h-4 w-24 rounded bg-gray-100" />
            <div className="h-7 w-32 rounded-lg bg-gray-200" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-gray-100" />
        <div className="h-64 rounded-2xl bg-gray-100" />
      </div>
    </div>
  );
}
