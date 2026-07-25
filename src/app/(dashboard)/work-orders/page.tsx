import { Wrench } from 'lucide-react';

export default function WorkOrdersPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(200,155,60,0.1)' }}>
        <Wrench className="h-10 w-10" style={{ color: '#C89B3C' }} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Work Orders</h1>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        Issue and track internal work orders for contractors and site teams.
      </p>
      <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(200,155,60,0.15)', color: '#C89B3C' }}>
        Coming soon
      </span>
    </div>
  );
}
