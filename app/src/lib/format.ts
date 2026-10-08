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

/**
 * Re-formats a plan qty string ("1.2 kg" / "4 pcs") for the active unit.
 * Count-based quantities pass through untouched.
 */
export function fmtQty(qty: string, unit: Unit): string {
  if (!qty.endsWith(' kg') && !qty.endsWith('kg')) return qty;
  const kg = parseFloat(qty);
  return Number.isFinite(kg) ? fmtWeight(kg, unit) : qty;
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

/** Elapsed cook time: M:SS under an hour, H:MM:SS after. Ticks every second. */
export function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}