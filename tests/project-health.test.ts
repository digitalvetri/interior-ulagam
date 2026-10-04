import { describe, it, expect } from 'vitest';
import { projectHealth } from '@/lib/project-money/health';

const base = {
  hasContract: true, overduePaise: 0, maxDaysOverdue: 0, collectedPct: 50, timeUsedPct: 50,
  stagePct: 55, daysLeft: 30, finished: false, committedPaise: 0, overdueLabel: null as string | null,
};

describe('projectHealth', () => {
  it('is on track when money, time and stage move together', () => {
    expect(projectHealth(base)).toMatchObject({ score: 100, status: 'on_track', items: [] });
  });

  it('flags overdue money first, with the amount', () => {
    const h = projectHealth({ ...base, overduePaise: 212_400_00, maxDaysOverdue: 12, overdueLabel: 'Material delivery' });
    expect(h.score).toBe(75);
    expect(h.items[0]).toMatchObject({ kind: 'overdue', tone: 'danger' });
  });

  it('needs attention when collection lags time', () => {
    const h = projectHealth({ ...base, timeUsedPct: 79, collectedPct: 29, stagePct: 70 });
    expect(h.status).toBe('needs_attention');
    expect(h.items.map(i => i.kind)).toContain('collection_behind');
  });

  it('is at risk when late, overdue for long, and behind', () => {
    const h = projectHealth({ ...base, overduePaise: 1, maxDaysOverdue: 40, daysLeft: -10, timeUsedPct: 110, collectedPct: 20, stagePct: 40 });
    expect(h.status).toBe('at_risk');
    expect(h.score).toBeLessThan(50);
    expect(h.items.map(i => i.kind)).toEqual(expect.arrayContaining(['overdue', 'late', 'collection_behind', 'work_behind']));
  });

  it('mentions unbilled purchase orders without lowering the score', () => {
    const h = projectHealth({ ...base, committedPaise: 85_000_00 });
    expect(h.score).toBe(100);
    expect(h.items.map(i => i.kind)).toEqual(['unbilled_pos']);
  });

  it('has no score until a contract is set', () => {
    expect(projectHealth({ ...base, hasContract: false })).toMatchObject({ score: null, status: 'unknown' });
  });

  it('never reports collection behind once handed over', () => {
    const h = projectHealth({ ...base, finished: true, timeUsedPct: 100, collectedPct: 70, stagePct: 95, daysLeft: 0 });
    expect(h.items.map(i => i.kind)).not.toContain('work_behind');
  });
});
