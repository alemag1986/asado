import { CUTS, CUT_MAP } from './cuts';
import type { Appetite, Cut, MeatPlan, PlanItem } from './types';

export const APPETITE_KG: Record<Appetite, number> = {
  light: 0.4,
  normal: 0.55,
  heavy: 0.75,
};

const ACHURA_SHARE = 0.3;
const MIN_WEIGHT_KG = 0.35;

function roundUp(n: number, step: number) {
  return Math.ceil(n / step) * step;
}

function countUnits(cut: Cut, people: number) {
  return Math.max(1, Math.ceil(people / (cut.unitPerPeople ?? 1)));
}

export function buildPlan(args: {
  adults: number;
  kids: number;
  appetite: Appetite;
  achuras: boolean;
  selected: string[];
}): MeatPlan {
  const { adults, kids, appetite, achuras, selected } = args;
  const adultEq = adults + kids * 0.6;
  const totalKg = adultEq * APPETITE_KG[appetite];

  // Achuras ride on the toggle, all-or-nothing.
  const achuraCuts = achuras ? CUTS.filter((c) => c.kind === 'achura') : [];

  const achuraItems: PlanItem[] = achuraCuts.map((cut) => {
    const qty = cut.unitPerPeople
      ? `${countUnits(cut, adults)} ${countUnits(cut, adults) === 1 ? 'pce' : 'pcs'}`
      : `${roundUp(adultEq * cut.perPersonKg, 0.1).toFixed(1).replace(/\.0$/, '')} kg`;
    return { cutId: cut.id, qty, note: cut.pullRule };
  });

  // Main cuts are chosen individually and split the remainder of the budget.
  const meatBudget = totalKg * (achuraCuts.length ? 1 - ACHURA_SHARE : 1);
  const main = selected
    .map((id) => CUT_MAP[id])
    .filter((c): c is Cut => !!c && c.kind !== 'achura');

  const weightSum = main.reduce((sum, cut) => sum + cut.perPersonKg, 0) || 1;
  const meatItems: PlanItem[] = main.map((cut) => {
    const share = (cut.perPersonKg / weightSum) * meatBudget;
    const kg = roundUp(Math.max(share, MIN_WEIGHT_KG), 0.1);
    return { cutId: cut.id, qty: `${kg.toFixed(1).replace(/\.0$/, '')} kg`, note: '' };
  });

  const items = [...achuraItems, ...meatItems];

  const order = items
    .slice()
    .sort((a, b) => CUT_MAP[a.cutId].minutes - CUT_MAP[b.cutId].minutes)
    .map((item) => CUT_MAP[item.cutId].local);

  const planKgTotal = items.reduce((sum, item) => {
    const kg = parseFloat(item.qty);
    return sum + (Number.isFinite(kg) ? kg : 0);
  }, 0);

  return {
    items,
    order,
    totalKg: roundUp(planKgTotal, 0.1),
    tip: achuraCuts.length
      ? 'Achuras hit the grate first while the fire is greedy, then the thin cuts. The rack is the finale.'
      : 'Thin cuts first over lively embers, thicker and slower cuts after. Keep it moving.',
  };
}