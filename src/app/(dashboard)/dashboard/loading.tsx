export default function DashboardPageLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-52 rounded-lg bg-gray-200" />
          <div className="h-4 w-40 rounded bg-gray-100" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-gray-100" />
        <div className="h-72 rounded-2xl bg-gray-100" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 rounded-2xl bg-gray-100" />
        <div className="h-48 rounded-2xl bg-gray-100" />
      </div>
    </div>
  );
}
