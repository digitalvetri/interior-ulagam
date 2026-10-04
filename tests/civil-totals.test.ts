import { describe, it, expect } from 'vitest';
import { sumLines, rupeesToPaise } from '@/lib/civil/totals';

describe('sumLines', () => {
  it('splits material and labour and totals them', () => {
    expect(sumLines([
      { kind: 'material', amountPaise: 600_000 },
      { kind: 'labour', amountPaise: 600_000 },
      { kind: 'labour', amountPaise: 300_000 },
    ])).toEqual({ materialPaise: 600_000, labourPaise: 900_000, totalPaise: 1_500_000 });
  });

  it('is zero for no lines', () => {
    expect(sumLines([])).toEqual({ materialPaise: 0, labourPaise: 0, totalPaise: 0 });
  });
});

describe('rupeesToPaise', () => {
  it('parses Indian-formatted rupee strings', () => {
    expect(rupeesToPaise('24,597')).toBe(2_459_700);
    expect(rupeesToPaise('1,500.50')).toBe(150_050);
    expect(rupeesToPaise(850)).toBe(85_000);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
  });

  it('returns null for blanks and non-numbers', () => {
    expect(rupeesToPaise('')).toBeNull();
    expect(rupeesToPaise('KISHORE')).toBeNull();
    expect(rupeesToPaise(null)).toBeNull();
  });
});
