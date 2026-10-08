import type { TempUnit, Unit } from './types';

export function kgToLb(kg: number) {
  return kg * 2.20462;
}

/** Formats a kg weight for the active unit, tidy steps. */
export function fmtWeight(kg: number, unit: Unit): string {
  if (unit === 'lb') {
    const lb = kgToLb(kg);
    return `${Math.ceil(lb * 2) / 2} lb`;
  }
  return `${kg.toFixed(1).replace(/\.0$/, '')} kg`;
}

export function cToF(c: number) {
  return Math.round((c * 9) / 5 + 32);
}

export function fmtTemp(c: number, unit: TempUnit): string {
  if (unit === 'f') return `${cToF(c)}°F`;
  return `${Math.round(c)}°C`;
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}