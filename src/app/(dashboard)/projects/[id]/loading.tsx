export default function ProjectDetailLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gray-200" />
        <div className="space-y-1.5">
          <div className="h-6 w-64 rounded-lg bg-gray-200" />
          <div className="h-4 w-40 rounded bg-gray-100" />
        </div>
        <div className="ml-auto flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-gray-100" />
          <div className="h-9 w-28 rounded-lg bg-gray-200" />
        </div>
      </div>
      <div className="flex gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-lg bg-gray-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-40 rounded-2xl bg-gray-100" />
          <div className="h-56 rounded-2xl bg-gray-100" />
        </div>
        <div className="space-y-4">
          <div className="h-36 rounded-2xl bg-gray-100" />
          <div className="h-36 rounded-2xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
