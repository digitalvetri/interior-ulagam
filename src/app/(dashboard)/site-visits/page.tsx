import { HardHat } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function SiteVisitsPage() {
  return (
    <ComingSoonPage
      icon={HardHat}
      title="Site Visits"
      description="Site visit logs are recorded per project. Open a project to view or add site logs."
      cta={{ href: '/projects', label: 'Go to Projects' }}
    />
  );
}
