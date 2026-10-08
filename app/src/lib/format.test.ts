import { describe, expect, test } from 'vitest';
import { fmtElapsed, fmtQty, fmtWeight } from './format';

describe('fmtElapsed', () => {
  test('shows M:SS under an hour and ticks every second', () => {
    expect(fmtElapsed(0)).toBe('0:00');
    expect(fmtElapsed(9_000)).toBe('0:09');
    expect(fmtElapsed(65_000)).toBe('1:05');
    expect(fmtElapsed(3_599_000)).toBe('59:59');
  });

  test('rolls to H:MM:SS after an hour', () => {
    expect(fmtElapsed(3_600_000)).toBe('1:00:00');
    expect(fmtElapsed(7_830_000)).toBe('2:10:30');
  });

  test('clamps negative or junk input to zero', () => {
    expect(fmtElapsed(-1)).toBe('0:00');
    expect(fmtElapsed(-400_000)).toBe('0:00');
  });
});

describe('fmtQty', () => {
  test('converts kg quantities to lb', () => {
    expect(fmtQty('1.2 kg', 'lb')).toBe('3 lb');
    expect(fmtQty('0.8 kg', 'lb')).toBe('2 lb');
  });

  test('leaves kg quantities alone in kg mode', () => {
    expect(fmtQty('1.2 kg', 'kg')).toBe('1.2 kg');
    expect(fmtQty('4.0 kg', 'kg')).toBe('4 kg');
  });

  test('passes count-based quantities through untouched', () => {
    expect(fmtQty('4 pcs', 'lb')).toBe('4 pcs');
    expect(fmtQty('1 pce', 'kg')).toBe('1 pce');
  });

  test('rounds lb to tidy half-steps like fmtWeight', () => {
    expect(fmtQty('0.35 kg', 'lb')).toBe('1 lb');
    expect(fmtQty('2.5 kg', 'lb')).toBe('6 lb');
    expect(fmtWeight(4, 'lb')).toBe('9 lb');
  });
});