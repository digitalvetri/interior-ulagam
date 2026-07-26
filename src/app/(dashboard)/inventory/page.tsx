import { Boxes } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function InventoryPage() {
  return (
    <ComingSoonPage
      icon={Boxes}
      title="Inventory & Stock"
      description="Stock levels are tracked through the Materials catalogue and Purchase Order GRNs."
      cta={{ href: '/materials', label: 'Go to Materials' }}
    />
  );
}
