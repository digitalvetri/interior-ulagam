import { CreditCard } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function PaymentsPage() {
  return (
    <ComingSoonPage
      icon={CreditCard}
      title="Payments"
      description="Payment tracking and reconciliation is managed in the Accounts module."
      cta={{ href: '/accounts', label: 'Go to Accounts' }}
    />
  );
}
