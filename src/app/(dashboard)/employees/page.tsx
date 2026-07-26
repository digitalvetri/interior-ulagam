import { UserCog } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function EmployeesPage() {
  return (
    <ComingSoonPage
      icon={UserCog}
      title="Employees"
      description="Manage your team — designers, site supervisors, and accountants — with role-based access control."
    />
  );
}
