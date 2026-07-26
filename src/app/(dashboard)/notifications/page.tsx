import { Bell } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function NotificationsPage() {
  return (
    <ComingSoonPage
      icon={Bell}
      title="Notifications"
      description="Overdue payments, pending approvals, site alerts, and follow-up reminders — all in one place."
    />
  );
}
