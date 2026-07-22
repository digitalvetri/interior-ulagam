import { describe, it, expect } from 'vitest';
import { computeMarginPaise, computeGst } from '../src/types/index';

describe('margin engine', () => {
  it('computes margin correctly in paise', () => {
    // clientRate 5000₹, costRate 3000₹, qty 10
    const margin = computeMarginPaise(500_000, 300_000, 10);
    expect(margin).toBe(2_000_000); // 20,000₹ margin
  });

  it('margin is 0 when client rate equals cost rate', () => {
    expect(computeMarginPaise(100_000, 100_000, 5)).toBe(0);
  });

  it('negative margin when selling below cost', () => {
    expect(computeMarginPaise(90_000, 100_000, 1)).toBe(-10_000);
  });
});

describe('GST computation', () => {
  it('splits intra-state GST as 9% CGST + 9% SGST', () => {
    const result = computeGst(100_000, 'TN'); // 1000₹ subtotal
    expect(result.isInterstate).toBe(false);
    expect(result.cgstPaise).toBe(9_000);
    expect(result.sgstPaise).toBe(9_000);
    expect(result.igstPaise).toBe(0);
    // Total GST = 18%
    expect(result.cgstPaise + result.sgstPaise).toBe(18_000);
  });

  it('uses IGST 18% for interstate supply', () => {
    const result = computeGst(100_000, 'KA'); // Karnataka — interstate
    expect(result.isInterstate).toBe(true);
    expect(result.igstPaise).toBe(18_000);
    expect(result.cgstPaise).toBe(0);
    expect(result.sgstPaise).toBe(0);
  });
});
