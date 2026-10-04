import { StatusBadge } from '@/components/ui/StatusBadge';
import type { CivilJobStatus } from '@/types/civil';

export function CivilStatusBadge({ status, className }: { status: CivilJobStatus; className?: string }) {
  return <StatusBadge module="civil_jobs" status={status} className={className} />;
}
