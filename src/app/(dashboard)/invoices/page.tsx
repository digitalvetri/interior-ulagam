import { Receipt } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function InvoicesPage() {
  return (
    <ComingSoonPage
      icon={Receipt}
      title="Invoices"
      description="Invoices and receivables are managed in the Accounts module."
      cta={{ href: '/accounts', label: 'Go to Accounts' }}
    />
  );
}
