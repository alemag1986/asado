import { FUELS } from './cuts';
import type { FirePlan, FireStep, FuelId } from './types';

const WOOD_STEPS: FireStep[] = [
  { title: 'Stack the firebox', detail: 'Crosshatch of hardwood, fine tinder built into the middle.' },
  { title: 'Light it lean', detail: 'No accelerant. A single match, or a firestarter between the splits.' },
  { title: 'Feed the beast', detail: 'Add one split at a time once it catches. Let it eat.' },
  { title: 'Break to coals', detail: 'When the wood collapses into chunks, push it apart into a bed.' },
  { title: 'Rake a full floor', detail: 'One even layer of embers under the whole grate.' },
];

const CHARCOAL_STEPS: FireStep[] = [
  { title: 'Build a mound', detail: 'Heap lump charcoal in a pyramid, window for air at the base.' },
  { title: 'Light a corner', detail: 'Chimney or a single lighter cube. The fire spreads itself.' },
  { title: 'Wait for the ash line', detail: 'Most pieces rimmed gray. White = past its best.' },
  { title: 'Spread the bed', detail: 'Level embers out. A tired corner can be topped back up.' },
];

const GAS_STEPS: FireStep[] = [
  { title: 'Purge the box', detail: 'Two minutes lid open before ignition, every single time.' },
  { title: 'Preheat on high', detail: 'Five to ten minutes, lid down, to rip the grates.' },
  { title: 'Drop to game heat', detail: 'Sear zone high, rest zone low — two heat zones even on gas.' },
];

const CHECKLIST = [
  'Embers are ash-gray, no visible flames',
  'The grate is hot — salt sizzles on contact',
  'Palm test: 3–5 s at 15 cm above the grate is dinner time',
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (isFinite(h) ? h : 18) * 60 + (isFinite(m) ? m : 0);
}

function toHHMM(total: number): string {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

const BASE_MEAT_KG = 5;

export function buildFire(args: {
  fuel: FuelId;
  cookMin: number;
  readyBy: string;
  meatKg?: number;
}): FirePlan {
  const fuel = FUELS.find((f) => f.id === args.fuel) ?? FUELS[1];
  const serving = toMinutes(args.readyBy);
  const cookMin = Math.max(1, args.cookMin);
  const buildMin = fuel.buildMin;
  const totalMin = buildMin + cookMin;

  const fireStartMin = serving - totalMin;
  const coalReady = fireStartMin + buildMin;

  // A real fire scales with what it must carry: more meat → a hotter, fuller bed.
  const meatKg = Math.max(0.5, args.meatKg ?? BASE_MEAT_KG);
  const weightFactor = Math.min(3, Math.max(0.5, meatKg / BASE_MEAT_KG));
  const fuelKg = fuel.rateKgH
    ? roundToHalf((fuel.rateKgH * (totalMin / 60)) * weightFactor)
    : 0;
  const fuelSteps =
    args.fuel === 'wood'
      ? WOOD_STEPS
      : args.fuel === 'gas'
        ? GAS_STEPS
        : CHARCOAL_STEPS;

  return {
    fuel,
    cookMin,
    fireStart: toHHMM(fireStartMin),
    coalReady: toHHMM(coalReady),
    firstOn: toHHMM(coalReady),
    serving: toHHMM(serving),
    fuelKg,
    steps: fuelSteps,
    checklist: CHECKLIST,
    bigFire: weightFactor > 1.5,
  };
}

function roundToHalf(n: number) {
  return Math.round(n * 2) / 2;
}