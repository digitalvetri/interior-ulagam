import { LayoutDashboard, Users, FolderKanban, IndianRupee } from 'lucide-react';

const kpiCards = [
  {
    label: 'Active Leads',
    value: '—',
    icon: Users,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    label: 'Active Projects',
    value: '—',
    icon: FolderKanban,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    label: 'Receivables',
    value: '—',
    icon: IndianRupee,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    label: 'Avg. Margin %',
    value: '—',
    icon: LayoutDashboard,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Overview of The Interior Studio
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className={`mb-3 inline-flex rounded-lg p-2 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Connect Supabase and add your first lead to see data here.
        </p>
      </div>
    </div>
  );
}
