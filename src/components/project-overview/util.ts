import type { ProjectStage } from '@/lib/project-money/calc';

// Small helpers shared by the project overview components.

/** How far along each stage is (matches the project-money engine). */
export const STAGE_PCT: Record<ProjectStage, number> = {
  design_pending: 10, design_in_progress: 30, design_approved: 45,
  procurement: 55, execution: 70, snagging: 85, handover: 95, complete: 100,
};

export const STAGES: ProjectStage[] = [
  'design_pending', 'design_in_progress', 'design_approved',
  'procurement', 'execution', 'snagging', 'handover', 'complete',
];

/** wa.me link; a bare 10-digit Indian number gets the 91 prefix. */
export function waLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** "2h", "3d", "2w", "4mo" — for the activity feed. */
export function relTime(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return mins <= 1 ? 'now' : `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

/** Whole days from today to a date (negative = past). */
export function daysUntil(iso: string): number {
  const end = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

/** One payment as GET /api/v1/payments?projectId= returns it. */
export interface ProjectPayment {
  id: string;
  receiptNumber: string | null;
  receivedAt: string | null;
  createdAt: string;
  amountPaise: number;
  status: string;
  mode: string | null;
  reference: string | null;
}

export const MODE_LABEL: Record<string, string> = {
  upi: 'UPI', cash: 'Cash', bank: 'Bank transfer', cheque: 'Cheque', card: 'Card', razorpay: 'Razorpay',
};
