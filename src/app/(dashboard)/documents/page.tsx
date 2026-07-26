import { FolderOpen } from 'lucide-react';
import { ComingSoonPage } from '@/components/ui/ComingSoonPage';

export default function DocumentsPage() {
  return (
    <ComingSoonPage
      icon={FolderOpen}
      title="Documents"
      description="Store and manage contracts, drawings, approvals, and project documents."
    />
  );
}
