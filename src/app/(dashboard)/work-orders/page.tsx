import { Wrench } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function WorkOrdersPage() {
  return (
    <ComingSoonPage
      icon={Wrench}
      title="Work Orders"
      description="Issue and track internal work orders for contractors and site teams."
    />
  );
}
