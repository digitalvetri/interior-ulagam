import { ShieldCheck } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function UserManagementPage() {
  return (
    <ComingSoonPage
      icon={ShieldCheck}
      title="User Management"
      description="Invite team members by email and assign roles — Owner, Designer, Supervisor, or Accountant."
    />
  );
}
