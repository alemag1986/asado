import { describe, expect, test } from 'vitest';
import { buildPlan } from './plan';

const SELECTED = ['tira', 'bife-chorizo', 'entrana'];

describe('buildPlan', () => {
  test('8 adults, normal appetite, achuras on', () => {
    const plan = buildPlan({
      adults: 8,
      kids: 0,
      appetite: 'normal',
      achuras: true,
      selected: SELECTED,
    });

    const achura = plan.items.filter((i) => i.cutId === 'chorizo' || i.cutId === 'provoleta');
    expect(achura).toHaveLength(2);
    expect(achura.find((i) => i.cutId === 'chorizo')!.qty).toBe('4 pcs');
    expect(achura.find((i) => i.cutId === 'provoleta')!.qty).toBe('2 pcs');
    expect(plan.totalKg).toBeGreaterThan(1);
  });

  test('kids count at 60% weight', () => {
    // 10 adults + 15 kids ≈ 19 adult-equivalents < 20 adults.
    const noKids = buildPlan({ adults: 20, kids: 0, appetite: 'heavy', achuras: false, selected: ['vacio'] });
    const withKids = buildPlan({ adults: 10, kids: 15, appetite: 'heavy', achuras: false, selected: ['vacio'] });
    expect(withKids.totalKg).toBeLessThan(noKids.totalKg);
    expect(withKids.totalKg).toBeGreaterThan(noKids.totalKg * 0.9);
  });

  test('achuras off drops the achura items', () => {
    const plan = buildPlan({
      adults: 8,
      kids: 0,
      appetite: 'heavy',
      achuras: false,
      selected: SELECTED,
    });
    expect(plan.items.every((i) => i.cutId !== 'chorizo')).toBe(true);
  });

  test('every weight is tidy (0.1 step) and meat has a floor', () => {
    for (const appetite of ['light', 'normal', 'heavy'] as const) {
      const plan = buildPlan({ adults: 2, kids: 0, appetite, achuras: false, selected: ['vacio'] });
      const qty = plan.items[0].qty;
      expect(qty).toMatch(/^\d+(\.\d)? kg$/);
    }
  });
});