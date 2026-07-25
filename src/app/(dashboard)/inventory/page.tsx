import { Boxes } from 'lucide-react';
import Link from 'next/link';

export default function InventoryPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="rounded-2xl p-5 mb-6" style={{ background: 'rgba(200,155,60,0.1)' }}>
        <Boxes className="h-10 w-10" style={{ color: '#C89B3C' }} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Inventory &amp; Stock</h1>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        Stock levels are tracked through the Materials catalogue and Purchase Order GRNs.
      </p>
      <Link href="/materials" className="btn-primary inline-block">
        Go to Materials
      </Link>
    </div>
  );
}
