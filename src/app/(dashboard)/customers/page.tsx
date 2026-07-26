import { UserCheck } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function CustomersPage() {
  return (
    <ComingSoonPage
      icon={UserCheck}
      title="Customers"
      description="Manage client profiles, contact history, and project associations."
    />
  );
}
