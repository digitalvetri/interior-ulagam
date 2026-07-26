import { CalendarDays } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function CalendarPage() {
  return (
    <ComingSoonPage
      icon={CalendarDays}
      title="Calendar"
      description="View site visits, project milestones, client meetings, and follow-up reminders in one calendar."
    />
  );
}
