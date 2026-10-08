export type FuelId = 'wood' | 'charcoal' | 'gas';
export type TempUnit = 'c' | 'f';
export type Appetite = 'light' | 'normal' | 'heavy';
export type Unit = 'kg' | 'lb';
export type CutKind = 'beef' | 'achura' | 'other';
export type Tier = 'fast' | 'medium' | 'slow';
export type Screen = 'landing' | 'meat' | 'fire' | 'cook';

export interface Cut {
  id: string;
  name: string;
  local: string;
  kind: CutKind;
  tier: Tier;
  perPersonKg: number;
  unitPerPeople?: number;
  minutes: number;
  targetTempC?: number;
  prep: string;
  signals: string[];
  rotateRule: string;
  pullRule: string;
  restMin: number;
  carve: string;
}

export interface PlanItem {
  cutId: string;
  qty: string;
  note: string;
}

export interface MeatPlan {
  items: PlanItem[];
  order: string[];
  totalKg: number;
  tip: string;
}

export interface FuelSpec {
  id: FuelId;
  label: string;
  local: string;
  buildMin: number;
  rateKgH: number;
  hint: string;
}

export interface FireStep {
  title: string;
  detail: string;
}

export interface FirePlan {
  fuel: FuelSpec;
  cookMin: number;
  fireStart: string;
  coalReady: string;
  firstOn: string;
  serving: string;
  fuelKg: number;
  steps: FireStep[];
  checklist: string[];
  bigFire: boolean;
}