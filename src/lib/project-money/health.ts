// Project health: one 0–100 score plus the few things worth doing today.
// Pure; inputs come from the project-money engine.

export type HealthStatus = 'on_track' | 'needs_attention' | 'at_risk' | 'unknown';
export type AttentionKind = 'overdue' | 'collection_behind' | 'work_behind' | 'late' | 'unbilled_pos' | 'no_contract';

export interface AttentionItem {
  kind: AttentionKind;
  tone: 'danger' | 'warning' | 'neutral';
}

export interface HealthInput {
  hasContract: boolean;
  overduePaise: number;
  maxDaysOverdue: number;
  overdueLabel: string | null;
  collectedPct: number | null;
  timeUsedPct: number | null;
  stagePct: number;
  daysLeft: number | null;
  finished: boolean;
  committedPaise: number;
}

/** How far collection or work may trail time before it counts. */
const COLLECTION_SLACK = 15;
const WORK_SLACK = 20;

export function projectHealth(h: HealthInput): { score: number | null; status: HealthStatus; items: AttentionItem[] } {
  if (!h.hasContract) return { score: null, status: 'unknown', items: [{ kind: 'no_contract', tone: 'neutral' }] };

  let score = 100;
  const items: AttentionItem[] = [];

  if (h.overduePaise > 0) {
    score -= h.maxDaysOverdue > 30 ? 35 : 25;
    items.push({ kind: 'overdue', tone: 'danger' });
  }
  if (!h.finished && h.daysLeft !== null && h.daysLeft < 0) {
    score -= 20;
    items.push({ kind: 'late', tone: 'danger' });
  }
  if (h.timeUsedPct !== null && h.collectedPct !== null) {
    const gap = h.timeUsedPct - h.collectedPct;
    if (gap > COLLECTION_SLACK) {
      score -= Math.min(25, Math.round(gap / 2));
      items.push({ kind: 'collection_behind', tone: 'warning' });
    }
  }
  if (!h.finished && h.timeUsedPct !== null) {
    const gap = h.timeUsedPct - h.stagePct;
    if (gap > WORK_SLACK) {
      score -= Math.min(20, Math.round(gap / 3));
      items.push({ kind: 'work_behind', tone: 'warning' });
    }
  }
  if (h.committedPaise > 0) items.push({ kind: 'unbilled_pos', tone: 'neutral' });

  score = Math.max(0, Math.min(100, score));
  return { score, status: score >= 80 ? 'on_track' : score >= 50 ? 'needs_attention' : 'at_risk', items };
}
