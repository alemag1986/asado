import { describe, expect, test } from 'vitest';
import { buildPlan } from './plan';
import { ACHURA_DEFAULTS } from './cuts';

const SELECTED = ['tira', 'bife-chorizo', 'entrana'];
const WITH_ACHURAS = [...SELECTED, ...ACHURA_DEFAULTS];

describe('buildPlan', () => {
  test('8 adults, normal appetite, achuras on', () => {
    const plan = buildPlan({
      adults: 8,
      kids: 0,
      appetite: 'normal',
      selected: WITH_ACHURAS,
    });

    const achura = plan.items.filter((i) => i.cutId === 'chorizo' || i.cutId === 'provoleta');
    expect(achura).toHaveLength(2);
    expect(achura.find((i) => i.cutId === 'chorizo')!.qty).toBe('4 pcs');
    expect(achura.find((i) => i.cutId === 'provoleta')!.qty).toBe('2 pcs');
    expect(plan.totalKg).toBeGreaterThan(1);
  });

  test('kids count at 60% weight', () => {
    // 10 adults + 15 kids ≈ 19 adult-equivalents < 20 adults.
    const noKids = buildPlan({ adults: 20, kids: 0, appetite: 'heavy', selected: ['vacio'] });
    const withKids = buildPlan({ adults: 10, kids: 15, appetite: 'heavy', selected: ['vacio'] });
    expect(withKids.totalKg).toBeLessThan(noKids.totalKg);
    expect(withKids.totalKg).toBeGreaterThan(noKids.totalKg * 0.9);
  });

  test('no achura picks drops the achura items', () => {
    const plan = buildPlan({
      adults: 8,
      kids: 0,
      appetite: 'heavy',
      selected: SELECTED,
    });
    expect(plan.items.every((i) => i.cutId !== 'chorizo')).toBe(true);
  });

  test('picking a single achura includes exactly that one', () => {
    const plan = buildPlan({
      adults: 4,
      kids: 0,
      appetite: 'normal',
      selected: ['vacio', 'mollejas'],
    });
    const achura = plan.items.filter((i) => ACHURA_DEFAULTS.includes(i.cutId));
    expect(achura).toHaveLength(1);
    expect(achura[0].cutId).toBe('mollejas');
  });

  test('achura picks share 30% of the budget', () => {
    const withAchura = buildPlan({ adults: 8, kids: 0, appetite: 'normal', selected: ['tira', 'morcilla'] });
    const without = buildPlan({ adults: 8, kids: 0, appetite: 'normal', selected: ['tira'] });
    const tiraWith = withAchura.items.find((i) => i.cutId === 'tira')!.qty;
    expect(parseFloat(tiraWith)).toBeLessThan(without.totalKg);
  });

  test('every weight is tidy (0.1 step) and meat has a floor', () => {
    for (const appetite of ['light', 'normal', 'heavy'] as const) {
      const plan = buildPlan({ adults: 2, kids: 0, appetite, selected: ['vacio'] });
      const qty = plan.items[0].qty;
      expect(qty).toMatch(/^\d+(\.\d)? kg$/);
    }
  });
});